import { mkdtemp, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getCatalogImportEnv,
  importCatalogPayload,
  loadCatalogImportFile,
  type CatalogImportClient,
} from './catalog-import'

function createMockImportClient() {
  const inserts: Record<string, unknown[][]> = {
    brands: [],
    brand_aliases: [],
    product_types: [],
  }
  const updates: Record<string, Array<Record<string, string>>> = {
    brands: [],
    product_types: [],
  }

  const state = {
    brands: [
      { id: 'brand-existing', slug: 'prada', name: 'PRADA' },
    ],
    brand_aliases: [
      { id: 'alias-existing', brand_id: 'brand-existing', alias: 'PRA*DA*' },
    ],
    product_types: [
      { id: 'product-existing', slug: 'bags', name: 'Bags' },
    ],
  }

  const client: CatalogImportClient = {
    from(table: string) {
      return {
        select: () => ({
          in: async (_column: string, values: string[]) => {
            if (table === 'brands') {
              return {
                data: state.brands.filter((row) => values.includes(row.slug)),
                error: null,
              }
            }

            if (table === 'brand_aliases') {
              return {
                data: state.brand_aliases.filter((row) => values.includes(row.brand_id)),
                error: null,
              }
            }

            return {
              data: state.product_types.filter((row) => values.includes(row.slug)),
              error: null,
            }
          },
        }),
        insert: async (values: unknown[]) => {
          inserts[table]?.push(values as unknown[])

          if (table === 'brands') {
            ;(values as Array<{ name: string; slug: string }>).forEach((row, index) => {
              state.brands.push({
                id: `brand-new-${index}`,
                slug: row.slug,
                name: row.name,
              })
            })
          }

          if (table === 'brand_aliases') {
            ;(values as Array<{ alias: string; brand_id: string }>).forEach((row, index) => {
              state.brand_aliases.push({
                id: `alias-new-${index}`,
                brand_id: row.brand_id,
                alias: row.alias,
              })
            })
          }

          if (table === 'product_types') {
            ;(values as Array<{ name: string; slug: string }>).forEach((row, index) => {
              state.product_types.push({
                id: `product-new-${index}`,
                slug: row.slug,
                name: row.name,
              })
            })
          }

          return { error: null }
        },
        update: (values: Record<string, string>) => ({
          eq: async (_column: string, value: string) => {
            updates[table]?.push(values)

            if (table === 'brands') {
              state.brands = state.brands.map((row) => row.id === value ? { ...row, ...values } : row)
            }

            if (table === 'product_types') {
              state.product_types = state.product_types.map((row) => row.id === value ? { ...row, ...values } : row)
            }

            return { error: null }
          },
        }),
      }
    },
  }

  return { client, inserts, updates }
}

describe('catalog import', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('fails clearly when required Supabase env vars are missing', () => {
    expect(() => getCatalogImportEnv({})).toThrow(
      'Missing required env vars: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are both required.',
    )
  })

  it('loads and validates a catalog import file', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'catalog-import-'))
    const filePath = join(directory, 'catalog-import.json')

    await writeFile(filePath, JSON.stringify({
      brands: [{ name: 'Prada', aliases: ['PRA*DA*'] }],
      product_types: [{ name: 'Bags' }],
    }))

    const result = await loadCatalogImportFile(filePath)

    expect(result.payload).toEqual({
      brands: [{ name: 'Prada', aliases: ['PRA*DA*'] }],
      product_types: [{ name: 'Bags' }],
    })
  })

  it('creates missing rows, updates renamed canonicals, and inserts new aliases', async () => {
    const { client, inserts, updates } = createMockImportClient()

    const result = await importCatalogPayload(client, {
      brands: [
        { name: 'Prada', aliases: ['PRA*DA*', 'Prd', 'Prd'] },
        { name: 'Louis Vuitton', aliases: ['LV', 'L V'] },
      ],
      product_types: [
        { name: 'Bags' },
        { name: 'Crossbody' },
      ],
    })

    expect(result).toEqual({
      brands_created: 1,
      brands_updated: 1,
      brand_aliases_created: 3,
      product_types_created: 1,
      product_types_updated: 0,
    })
    expect(inserts.brands[0]).toEqual([
      expect.objectContaining({ name: 'Louis Vuitton', slug: 'louis-vuitton' }),
    ])
    expect(inserts.brand_aliases[0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ alias: 'Prd' }),
        expect.objectContaining({ alias: 'LV' }),
        expect.objectContaining({ alias: 'L V' }),
      ]),
    )
    expect(updates.brands).toEqual([
      { name: 'Prada', slug: 'prada' },
    ])
  })
})
