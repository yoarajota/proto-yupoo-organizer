import {
  buildCatalogEmbedding,
  type CatalogEmbeddingEntityType,
} from './catalog-embeddings.ts'

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

type CatalogEmbeddingRow = {
  brand_alias_id: string | null
  brand_id: string | null
  entity_ref: string
  entity_type: CatalogEmbeddingEntityType
  id: string
  product_type_id: string | null
  source_hash: string
}

export type CatalogEmbeddingsSeedClient = {
  from: (table: string) => {
    select: (columns: string) => PromiseLike<{
      data: unknown[] | null
      error: { message: string } | null
    }>
    upsert: (values: unknown[], options: { onConflict: string }) => PromiseLike<{
      error: { message: string } | null
    }>
    delete: () => {
      in: (column: string, values: string[]) => PromiseLike<{ error: { message: string } | null }>
    }
  }
}

export function getCatalogEmbeddingSeedEnv(env: Partial<NodeJS.ProcessEnv> = process.env) {
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

export function buildCatalogEmbeddingSeedPayload(input: {
  brandAliases: BrandAliasRow[]
  brands: BrandRow[]
  productTypes: ProductTypeRow[]
}) {
  const rows = [
    ...input.brands.map((brand) => ({
      entity_type: 'brand' as const,
      entity_ref: brand.id,
      brand_id: brand.id,
      brand_alias_id: null,
      product_type_id: null,
      source_text: brand.name,
    })),
    ...input.brandAliases.map((alias) => ({
      entity_type: 'brand_alias' as const,
      entity_ref: alias.id,
      brand_id: null,
      brand_alias_id: alias.id,
      product_type_id: null,
      source_text: alias.alias,
    })),
    ...input.productTypes.map((productType) => ({
      entity_type: 'product_type' as const,
      entity_ref: productType.id,
      brand_id: null,
      brand_alias_id: null,
      product_type_id: productType.id,
      source_text: productType.name,
    })),
  ]

  return rows.map((row) => {
    const embedding = buildCatalogEmbedding(row.source_text)

    return {
      ...row,
      source_hash: embedding.source_hash,
      embedding: embedding.pgvector,
    }
  })
}

function buildCatalogEmbeddingKey(row: Pick<CatalogEmbeddingRow, 'entity_ref' | 'entity_type' | 'source_hash'>) {
  return `${row.entity_type}:${row.entity_ref}:${row.source_hash}`
}

export async function seedCatalogEmbeddings(client: CatalogEmbeddingsSeedClient) {
  const brandsResult = await client.from('brands').select('id, name, slug')
  if (brandsResult.error) throw new Error(brandsResult.error.message)

  const brandAliasesResult = await client.from('brand_aliases').select('id, brand_id, alias')
  if (brandAliasesResult.error) throw new Error(brandAliasesResult.error.message)

  const productTypesResult = await client.from('product_types').select('id, name, slug')
  if (productTypesResult.error) throw new Error(productTypesResult.error.message)

  const payload = buildCatalogEmbeddingSeedPayload({
    brands: (brandsResult.data ?? []) as BrandRow[],
    brandAliases: (brandAliasesResult.data ?? []) as BrandAliasRow[],
    productTypes: (productTypesResult.data ?? []) as ProductTypeRow[],
  })

  if (payload.length > 0) {
    const upsertResult = await client.from('catalog_embeddings').upsert(
      payload.map((row) => ({
        entity_type: row.entity_type,
        brand_id: row.brand_id,
        brand_alias_id: row.brand_alias_id,
        product_type_id: row.product_type_id,
        source_text: row.source_text,
        source_hash: row.source_hash,
        embedding: row.embedding,
      })),
      {
        onConflict: 'entity_type,entity_ref,source_hash',
      },
    )

    if (upsertResult.error) throw new Error(upsertResult.error.message)
  }

  const existingResult = await client
    .from('catalog_embeddings')
    .select('id, entity_type, entity_ref, source_hash, brand_id, brand_alias_id, product_type_id')

  if (existingResult.error) throw new Error(existingResult.error.message)

  const expectedKeys = new Set(payload.map((row) => buildCatalogEmbeddingKey(row)))
  const staleIds = ((existingResult.data ?? []) as CatalogEmbeddingRow[])
    .filter((row) => !expectedKeys.has(buildCatalogEmbeddingKey(row)))
    .map((row) => row.id)

  if (staleIds.length > 0) {
    const deleteResult = await client.from('catalog_embeddings').delete().in('id', staleIds)
    if (deleteResult.error) throw new Error(deleteResult.error.message)
  }

  return {
    brands: (brandsResult.data ?? []).length,
    brand_aliases: (brandAliasesResult.data ?? []).length,
    product_types: (productTypesResult.data ?? []).length,
    upserted_embeddings: payload.length,
    pruned_embeddings: staleIds.length,
  }
}
