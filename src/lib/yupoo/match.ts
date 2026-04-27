import { extractIntentSignals } from '@/lib/yupoo/classification'

type DiscoveredSupplier = {
  id: string
  supplier_key: string
  category_refs: string[]
  normalized_category_refs?: string[]
  last_seen_at: string
  confidence: number | string | null
}

export type RankedSupplier = {
  supplier_id: string
  rank_score: number
  rank_reasons: {
    normalized_overlap: number
    normalized_brand_overlap: number
    normalized_product_overlap: number
    raw_keyword_overlap: number
    supplier_confidence: number
    freshness_score: number
  }
}

function tokenize(input: string) {
  return input
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}

function scoreFreshness(lastSeenAt: string, nowIso: string) {
  const last = new Date(lastSeenAt).getTime()
  const now = new Date(nowIso).getTime()
  if (!Number.isFinite(last) || !Number.isFinite(now)) return 0.4

  const ageDays = (now - last) / (24 * 60 * 60 * 1000)
  if (ageDays <= 7) return 1
  if (ageDays <= 30) return 0.7
  return 0.4
}

function clamp01(value: number) {
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

function round4(value: number) {
  return Math.round(value * 10000) / 10000
}

export function rankSuppliersForMission(
  productIntent: string,
  suppliers: DiscoveredSupplier[],
  nowIso: string,
): RankedSupplier[] {
  const intentTokens = new Set(tokenize(productIntent))
  const intentSignals = extractIntentSignals(productIntent)
  const intentNormalizedRefs = new Set(
    [
      intentSignals.brand_signal,
      ...intentSignals.product_signals,
    ].filter((value): value is string => Boolean(value)),
  )

  return suppliers
    .map((supplier) => {
      const rawRefTokens = new Set(tokenize([supplier.supplier_key, ...(supplier.category_refs ?? [])].join(' ')))
      const normalizedRefs = new Set(supplier.normalized_category_refs ?? [])
      let rawOverlapCount = 0
      let normalizedOverlapCount = 0
      let normalizedBrandOverlap = 0
      let normalizedProductOverlap = 0

      intentTokens.forEach((token) => {
        if (rawRefTokens.has(token)) rawOverlapCount += 1
      })

      intentNormalizedRefs.forEach((token) => {
        if (!normalizedRefs.has(token)) return

        normalizedOverlapCount += 1
        if (token === intentSignals.brand_signal) {
          normalizedBrandOverlap = 1
        } else {
          normalizedProductOverlap += 1
        }
      })

      const rawKeywordOverlap = intentTokens.size === 0 ? 0 : rawOverlapCount / intentTokens.size
      const normalizedOverlap =
        intentNormalizedRefs.size === 0 ? 0 : normalizedOverlapCount / intentNormalizedRefs.size
      const supplierConfidence = clamp01(Number(supplier.confidence ?? 0))
      const freshnessScore = scoreFreshness(supplier.last_seen_at, nowIso)

      const rankScore = round4(
        normalizedOverlap * 0.55 +
        rawKeywordOverlap * 0.2 +
        supplierConfidence * 0.15 +
        freshnessScore * 0.1,
      )

      return {
        supplier_id: supplier.id,
        rank_score: rankScore,
        rank_reasons: {
          normalized_overlap: round4(normalizedOverlap),
          normalized_brand_overlap: round4(normalizedBrandOverlap),
          normalized_product_overlap: round4(
            intentSignals.product_signals.length === 0
              ? 0
              : normalizedProductOverlap / intentSignals.product_signals.length,
          ),
          raw_keyword_overlap: round4(rawKeywordOverlap),
          supplier_confidence: round4(supplierConfidence),
          freshness_score: round4(freshnessScore),
        },
      }
    })
    .sort((a, b) => b.rank_score - a.rank_score)
}
