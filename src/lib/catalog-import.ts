import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { toSlug } from './catalog.ts'
import {
  CatalogImportPayloadSchema,
  type CatalogImportPayload,
} from './schemas/catalog.ts'

type QueryResult<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>
type MutationResult = PromiseLike<{ error: { message: string } | null }>

type BrandRow = {
  id: string
  name: string
  slug: string
}

type BrandAliasRow = {
  alias: string
  brand_id: string
  id: string
}

type ProductTypeRow = {
  id: string
  name: string
  slug: string
}

export type CatalogImportClient = {
  from: (table: string) => {
    select: (columns: string) => {
      in: (column: string, values: string[]) => QueryResult<unknown>
    }
    insert: (values: unknown[]) => MutationResult
    update: (values: Record<string, string>) => {
      eq: (column: string, value: string) => MutationResult
    }
  }
}

export const DEFAULT_CATALOG_IMPORT_PATH = 'data/catalog-import.json'

function dedupeStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
}

export function getCatalogImportEnv(env: Partial<NodeJS.ProcessEnv> = process.env) {
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Missing required env vars: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are both required.',
    )
  }

  return {
    supabaseUrl,
    serviceRoleKey,
  }
}

export async function loadCatalogImportFile(filePath: string) {
  const absolutePath = resolve(filePath)
  const raw = await readFile(absolutePath, 'utf8')
  const parsed = CatalogImportPayloadSchema.safeParse(JSON.parse(raw))

  if (!parsed.success) {
    throw new Error(`Invalid catalog import file: ${parsed.error.issues[0]?.message ?? 'schema error'}.`)
  }

  return {
    path: absolutePath,
    payload: parsed.data,
  }
}

function normalizeCatalogImportPayload(payload: CatalogImportPayload) {
  return {
    brands: payload.brands.map((brand) => ({
      name: brand.name.trim(),
      slug: toSlug(brand.name),
      aliases: dedupeStrings(brand.aliases),
    })).filter((brand) => brand.slug),
    productTypes: payload.product_types.map((productType) => ({
      name: productType.name.trim(),
      slug: toSlug(productType.name),
    })).filter((productType) => productType.slug),
  }
}

async function selectBySlugs<T extends { slug: string }>(
  client: CatalogImportClient,
  table: 'brands' | 'product_types',
  slugs: string[],
) {
  if (slugs.length === 0) return [] as T[]

  const { data, error } = await client.from(table).select('id, name, slug').in('slug', slugs)
  if (error) throw new Error(error.message)
  return (data ?? []) as T[]
}

async function insertMissingRows(
  client: CatalogImportClient,
  table: 'brands' | 'product_types',
  values: Array<{ name: string; slug: string }>,
) {
  if (values.length === 0) return
  const { error } = await client.from(table).insert(values)
  if (error) throw new Error(error.message)
}

async function updateRowNameIfNeeded(
  client: CatalogImportClient,
  table: 'brands' | 'product_types',
  existing: Array<{ id: string; name: string; slug: string }>,
  incoming: Array<{ name: string; slug: string }>,
) {
  const incomingBySlug = new Map(incoming.map((row) => [row.slug, row]))

  await Promise.all(existing.map(async (row) => {
    const next = incomingBySlug.get(row.slug)
    if (!next || next.name === row.name) return

    const { error } = await client.from(table).update({ name: next.name, slug: next.slug }).eq('id', row.id)
    if (error) throw new Error(error.message)
  }))
}

async function insertMissingBrandAliases(
  client: CatalogImportClient,
  brandRows: BrandRow[],
  existingAliasRows: BrandAliasRow[],
  importedBrands: Array<{ aliases: string[]; name: string; slug: string }>,
) {
  const brandsBySlug = new Map(brandRows.map((row) => [row.slug, row]))
  const existingKeys = new Set(existingAliasRows.map((row) => `${row.brand_id}::${row.alias}`))
  const inserts = importedBrands.flatMap((brand) => {
    const brandRow = brandsBySlug.get(brand.slug)
    if (!brandRow) return []

    return dedupeStrings(brand.aliases)
      .filter((alias) => alias !== brandRow.name)
      .filter((alias) => !existingKeys.has(`${brandRow.id}::${alias}`))
      .map((alias) => ({
        brand_id: brandRow.id,
        alias,
      }))
  })

  if (inserts.length === 0) return 0

  const { error } = await client.from('brand_aliases').insert(inserts)
  if (error) throw new Error(error.message)
  return inserts.length
}

export async function importCatalogPayload(
  client: CatalogImportClient,
  payload: CatalogImportPayload,
) {
  const normalized = normalizeCatalogImportPayload(payload)

  const existingBrands = await selectBySlugs<BrandRow>(
    client,
    'brands',
    normalized.brands.map((brand) => brand.slug),
  )
  const existingBrandSlugs = new Set(existingBrands.map((brand) => brand.slug))
  const missingBrands = normalized.brands
    .filter((brand) => !existingBrandSlugs.has(brand.slug))
    .map(({ aliases: _aliases, ...brand }) => brand)

  await insertMissingRows(client, 'brands', missingBrands)
  await updateRowNameIfNeeded(client, 'brands', existingBrands, normalized.brands)

  const brandRows = await selectBySlugs<BrandRow>(
    client,
    'brands',
    normalized.brands.map((brand) => brand.slug),
  )

  const brandIds = brandRows.map((brand) => brand.id)
  const existingAliasesResult = brandIds.length === 0
    ? { data: [] as BrandAliasRow[], error: null }
    : await client.from('brand_aliases').select('id, brand_id, alias').in('brand_id', brandIds)
  if (existingAliasesResult.error) throw new Error(existingAliasesResult.error.message)

  const insertedBrandAliases = await insertMissingBrandAliases(
    client,
    brandRows,
    (existingAliasesResult.data ?? []) as BrandAliasRow[],
    normalized.brands,
  )

  const existingProductTypes = await selectBySlugs<ProductTypeRow>(
    client,
    'product_types',
    normalized.productTypes.map((productType) => productType.slug),
  )
  const existingProductTypeSlugs = new Set(existingProductTypes.map((productType) => productType.slug))
  const missingProductTypes = normalized.productTypes
    .filter((productType) => !existingProductTypeSlugs.has(productType.slug))

  await insertMissingRows(client, 'product_types', missingProductTypes)
  await updateRowNameIfNeeded(client, 'product_types', existingProductTypes, normalized.productTypes)

  return {
    brands_created: missingBrands.length,
    brands_updated: existingBrands.filter((row) => {
      const next = normalized.brands.find((brand) => brand.slug === row.slug)
      return next && next.name !== row.name
    }).length,
    brand_aliases_created: insertedBrandAliases,
    product_types_created: missingProductTypes.length,
    product_types_updated: existingProductTypes.filter((row) => {
      const next = normalized.productTypes.find((productType) => productType.slug === row.slug)
      return next && next.name !== row.name
    }).length,
  }
}
