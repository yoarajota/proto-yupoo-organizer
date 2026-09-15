import { describe, expect, it, vi } from 'vitest'
import {
  buildCatalogEmbeddingSeedPayload,
  getCatalogEmbeddingSeedEnv,
  seedCatalogEmbeddings,
  type CatalogEmbeddingsSeedClient,
} from './catalog-embeddings-seed'

function createMockClient() {
  const upsert = vi.fn().mockResolvedValue({ error: null })
  const deleteIn = vi.fn().mockResolvedValue({ error: null })

  const client: CatalogEmbeddingsSeedClient = {
    from(table: string) {
      if (table === 'brands') {
        return {
          select: () => Promise.resolve({
            data: [{ id: 'brand-1', name: 'Prada', slug: 'prada' }],
            error: null,
          }),
          upsert,
          delete: () => ({ in: deleteIn }),
        }
      }

      if (table === 'brand_aliases') {
        return {
          select: () => Promise.resolve({
            data: [{ id: 'alias-1', brand_id: 'brand-1', alias: 'PRA*DA*' }],
            error: null,
          }),
          upsert,
          delete: () => ({ in: deleteIn }),
        }
      }

      if (table === 'product_types') {
        return {
          select: () => Promise.resolve({
            data: [{ id: 'product-1', name: 'Bags', slug: 'bags' }],
            error: null,
          }),
          upsert,
          delete: () => ({ in: deleteIn }),
        }
      }

      return {
        select: () => Promise.resolve({
          data: [
            {
              id: 'existing-1',
              entity_type: 'brand',
              entity_ref: 'brand-1',
              brand_id: 'brand-1',
              brand_alias_id: null,
              product_type_id: null,
              source_hash: buildCatalogEmbeddingSeedPayload({
                brands: [{ id: 'brand-1', name: 'Prada', slug: 'prada' }],
                brandAliases: [],
                productTypes: [],
              })[0].source_hash,
            },
            {
              id: 'stale-1',
              entity_type: 'brand_alias',
              entity_ref: 'missing-alias',
              brand_id: null,
              brand_alias_id: 'missing-alias',
              product_type_id: null,
              source_hash: 'obsolete',
            },
          ],
          error: null,
        }),
        upsert,
        delete: () => ({ in: deleteIn }),
      }
    },
  }

  return { client, upsert, deleteIn }
}

describe('catalog embedding seed helpers', () => {
  it('fails clearly when service role env vars are missing', () => {
    expect(() => getCatalogEmbeddingSeedEnv({})).toThrow(
      'Missing required env vars: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are both required.',
    )
  })

  it('builds payload rows from existing catalog records', () => {
    const payload = buildCatalogEmbeddingSeedPayload({
      brands: [{ id: 'brand-1', name: 'Prada', slug: 'prada' }],
      brandAliases: [{ id: 'alias-1', brand_id: 'brand-1', alias: 'PRA*DA*' }],
      productTypes: [{ id: 'product-1', name: 'Bags', slug: 'bags' }],
    })

    expect(payload).toHaveLength(3)
    expect(payload[1]).toMatchObject({
      entity_type: 'brand_alias',
      brand_alias_id: 'alias-1',
      source_text: 'PRA*DA*',
    })
  })

  it('reads rows, upserts embeddings, and prunes stale records', async () => {
    const { client, upsert, deleteIn } = createMockClient()

    const result = await seedCatalogEmbeddings(client)

    expect(result).toEqual({
      brands: 1,
      brand_aliases: 1,
      product_types: 1,
      upserted_embeddings: 3,
      pruned_embeddings: 1,
    })
    expect(upsert).toHaveBeenCalledTimes(1)
    expect(upsert.mock.calls[0]?.[0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entity_type: 'brand',
          brand_id: 'brand-1',
        }),
        expect.objectContaining({
          entity_type: 'brand_alias',
          brand_alias_id: 'alias-1',
        }),
        expect.objectContaining({
          entity_type: 'product_type',
          product_type_id: 'product-1',
        }),
      ]),
    )
    expect(deleteIn).toHaveBeenCalledWith('id', ['stale-1'])
  })
})
