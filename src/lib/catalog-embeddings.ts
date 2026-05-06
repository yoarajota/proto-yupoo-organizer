import { createHash } from 'node:crypto'

export const CATALOG_EMBEDDING_DIMENSIONS = 384
export const CATALOG_EMBEDDING_BRAND_THRESHOLD = 0.7
export const CATALOG_EMBEDDING_PRODUCT_THRESHOLD = 0.76

export type CatalogEmbeddingEntityType = 'brand' | 'brand_alias' | 'product_type'

export type CatalogEmbeddingMatch = {
  entity_type: CatalogEmbeddingEntityType
  entity_id: string
  canonical_slug: string
  canonical_name: string
  source_text: string
  similarity: number
  threshold: number
}

const LEET_CHAR_MAP: Record<string, string> = {
  '!': 'i',
  '$': 's',
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '6': 'g',
  '7': 't',
  '8': 'b',
  '9': 'g',
  '@': 'a',
}

function compactSingleLetterRuns(tokens: string[]) {
  const compacted: string[] = []
  let pending = ''

  tokens.forEach((token) => {
    if (/^[a-z]$/.test(token)) {
      pending += token
      return
    }

    if (pending.length >= 2) compacted.push(pending)
    pending = ''
    compacted.push(token)
  })

  if (pending.length >= 2) compacted.push(pending)

  return compacted
}

function hashGram(input: string) {
  let hash = 2166136261

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}

function round6(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000
}

export function cleanCatalogEmbeddingText(input: string) {
  const punctuationCollapsed = input.replace(
    /(?<=\p{L})[^\p{L}\p{N}\s]+(?=\p{L})/gu,
    '',
  )

  const normalized = Array.from(
    punctuationCollapsed
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase(),
  )
    .map((char) => LEET_CHAR_MAP[char] ?? char)
    .join('')
    .replace(/[_/|]+/g, ' ')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/(.)\1{2,}/g, '$1$1')
    .trim()

  return compactSingleLetterRuns(normalized.split(/\s+/).filter(Boolean)).join(' ')
}

export function hashCatalogEmbeddingSource(input: string) {
  return createHash('sha256').update(cleanCatalogEmbeddingText(input)).digest('hex')
}

export function buildCatalogEmbeddingVector(input: string) {
  const cleaned = cleanCatalogEmbeddingText(input)
  const padded = `  ${cleaned || ' '}  `
  const vector = new Array<number>(CATALOG_EMBEDDING_DIMENSIONS).fill(0)

  for (let index = 0; index < padded.length - 2; index += 1) {
    const gram = padded.slice(index, index + 3)
    const dimension = hashGram(gram) % CATALOG_EMBEDDING_DIMENSIONS
    vector[dimension] += 1
  }

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + (value ** 2), 0))
  if (magnitude === 0) return vector

  return vector.map((value) => round6(value / magnitude))
}

export function serializeCatalogEmbeddingVector(vector: number[]) {
  return `[${vector.map((value) => Number.isFinite(value) ? value : 0).join(',')}]`
}

export function buildCatalogEmbedding(input: string) {
  const vector = buildCatalogEmbeddingVector(input)

  return {
    cleaned_text: cleanCatalogEmbeddingText(input),
    source_hash: hashCatalogEmbeddingSource(input),
    vector,
    pgvector: serializeCatalogEmbeddingVector(vector),
  }
}

export function stripCatalogSignal(input: string, signal: string | null) {
  if (!signal) return input

  const cleanedInput = cleanCatalogEmbeddingText(input)
  const cleanedSignal = cleanCatalogEmbeddingText(signal)
  if (!cleanedSignal) return cleanedInput

  return cleanCatalogEmbeddingText(
    cleanedInput.replace(new RegExp(`\\b${cleanedSignal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'), ' '),
  )
}
