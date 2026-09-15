import { describe, expect, it } from 'vitest'
import {
  buildCatalogEmbedding,
  buildCatalogEmbeddingVector,
  cleanCatalogEmbeddingText,
  hashCatalogEmbeddingSource,
  serializeCatalogEmbeddingVector,
} from './catalog-embeddings'

describe('catalog embeddings', () => {
  it('normalizes masked aliases deterministically', () => {
    expect(cleanCatalogEmbeddingText('PRA*DA*')).toBe('prada')
    expect(hashCatalogEmbeddingSource('PRA*DA*')).toBe(hashCatalogEmbeddingSource('Prada'))
  })

  it('builds deterministic normalized vectors', () => {
    const left = buildCatalogEmbeddingVector('Louis Vuitton')
    const right = buildCatalogEmbeddingVector('Louis Vuitton')

    expect(left).toEqual(right)
    expect(Math.hypot(...left)).toBeCloseTo(1, 5)
  })

  it('serializes pgvector payloads consistently', () => {
    const embedding = buildCatalogEmbedding('PRA*DA*')

    expect(embedding.cleaned_text).toBe('prada')
    expect(serializeCatalogEmbeddingVector(embedding.vector)).toBe(embedding.pgvector)
    expect(embedding.pgvector.startsWith('[')).toBe(true)
  })
})
