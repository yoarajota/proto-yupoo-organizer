import {
  CANONICAL_BRANDS,
  CANONICAL_PRODUCTS,
  type CanonicalBrand,
  type CanonicalProduct,
} from '@/lib/yupoo/category-config'
import type {
  ClassificationMethod,
  ClassificationStatus,
} from '@/lib/schemas/sourcing-classification'

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

export type ClassifiedCategory = {
  normalized_label: string
  brand_signal: string | null
  product_signal: string | null
  classification_status: ClassificationStatus
  classification_confidence: number
  classification_method: ClassificationMethod
  display_label: string
  evidence: Record<string, unknown>
  downstream_refs: string[]
}

export type ClassificationContext = {
  repeated_normalized_label_count?: number
  repeated_within_shop_label_count?: number
  repeated_signal_pair_count?: number
}

type AliasMatch<TCanonical extends string = string> = {
  canonical: TCanonical
  matched_alias: string
  match_type: 'exact' | 'contains'
}

type EmbeddingBrandMatch = {
  canonical: string
  similarity: number
  matched_term: string
}

const CLASSIFICATION_THRESHOLDS = {
  directBrandOnlyAutoAccept: 0.9,
  embeddingBrandMinSimilarity: 0.7,
  repeatedBrandProductAutoAccept: 0.74,
  strictBrandProductAutoAccept: 0.82,
} as const

function round4(value: number) {
  return Math.round(value * 10000) / 10000
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

export function cleanupCategoryText(input: string) {
  const normalized = Array.from(
    input
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

  const compactedTokens = compactSingleLetterRuns(
    normalized.split(/\s+/).filter(Boolean),
  )

  return compactedTokens.join(' ')
}

function tokenize(input: string) {
  return cleanupCategoryText(input)
    .split(/\s+/)
    .filter(Boolean)
}

function buildAliasMap<T extends { canonical: string; aliases: string[] }>(entries: T[]) {
  const map = new Map<string, string>()
  entries.forEach((entry) => {
    map.set(cleanupCategoryText(entry.canonical), entry.canonical)
    entry.aliases.forEach((alias) => {
      map.set(cleanupCategoryText(alias), entry.canonical)
      map.set(cleanupCategoryText(alias).replace(/\s+/g, ''), entry.canonical)
    })
  })
  return map
}

const BRAND_ALIAS_MAP = buildAliasMap(CANONICAL_BRANDS)
const PRODUCT_ALIAS_MAP = buildAliasMap(CANONICAL_PRODUCTS)

function findAliasMatchDetailed<T extends CanonicalBrand | CanonicalProduct>(
  cleaned: string,
  entries: T[],
  aliasMap: Map<string, string>,
): AliasMatch<T['canonical']> | null {
  const compact = cleaned.replace(/\s+/g, '')
  const direct = aliasMap.get(cleaned) ?? aliasMap.get(compact)

  if (direct) {
    return {
      canonical: direct as T['canonical'],
      matched_alias: cleaned,
      match_type: 'exact',
    }
  }

  for (const entry of entries) {
    const candidates = [entry.canonical, ...entry.aliases].map(cleanupCategoryText)
    const matchedAlias = candidates.find((candidate) => cleaned.includes(candidate))
    if (matchedAlias) {
      return {
        canonical: entry.canonical as T['canonical'],
        matched_alias: matchedAlias,
        match_type: 'contains',
      }
    }
  }

  return null
}

function findAliasMatch(
  cleaned: string,
  entries: Array<CanonicalBrand | CanonicalProduct>,
  aliasMap: Map<string, string>,
) {
  return findAliasMatchDetailed(cleaned, entries, aliasMap)?.canonical ?? null
}

function grams3(input: string) {
  const compact = `  ${input.replace(/\s+/g, ' ')}  `
  const counts = new Map<string, number>()
  for (let index = 0; index < compact.length - 2; index += 1) {
    const gram = compact.slice(index, index + 3)
    counts.set(gram, (counts.get(gram) ?? 0) + 1)
  }
  return counts
}

function cosineSimilarity(left: Map<string, number>, right: Map<string, number>) {
  let dot = 0
  let leftNorm = 0
  let rightNorm = 0

  left.forEach((value, key) => {
    dot += value * (right.get(key) ?? 0)
    leftNorm += value ** 2
  })
  right.forEach((value) => {
    rightNorm += value ** 2
  })

  if (leftNorm === 0 || rightNorm === 0) return 0
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm))
}

function rankBrandByEmbedding(cleaned: string, productSignal: string | null): EmbeddingBrandMatch | null {
  const stripped = cleanupCategoryText(
    productSignal ? cleaned.replace(new RegExp(productSignal, 'g'), ' ') : cleaned,
  )
  const vector = grams3(stripped)
  let best: EmbeddingBrandMatch | null = null

  CANONICAL_BRANDS.forEach((brand) => {
    let bestTerm = brand.embeddingTerms[0] ?? brand.canonical
    let similarity = 0

    brand.embeddingTerms.forEach((term) => {
      const score = cosineSimilarity(vector, grams3(cleanupCategoryText(term)))
      if (score > similarity) {
        similarity = score
        bestTerm = term
      }
    })

    if (!best || similarity > best.similarity) {
      best = {
        canonical: brand.canonical,
        similarity,
        matched_term: bestTerm,
      }
    }
  })

  return best
}

function lookupBrandDisplay(canonical: string | null) {
  if (!canonical) return null
  return CANONICAL_BRANDS.find((brand) => brand.canonical === canonical)?.display ?? canonical.toUpperCase()
}

function lookupProductDisplay(canonical: string | null) {
  if (!canonical) return null
  return CANONICAL_PRODUCTS.find((product) => product.canonical === canonical)?.display ?? canonical
}

function buildDisplayLabel(brandSignal: string | null, productSignal: string | null, fallback: string) {
  const brandDisplay = lookupBrandDisplay(brandSignal)
  const productDisplay = lookupProductDisplay(productSignal)
  const combined = [brandDisplay, productDisplay].filter(Boolean).join(' ')
  return combined || fallback
}

export function normalizeBrandSignal(input?: string | null) {
  if (!input) return null
  const cleaned = cleanupCategoryText(input)
  return findAliasMatch(cleaned, CANONICAL_BRANDS, BRAND_ALIAS_MAP) ?? cleaned.replace(/\s+/g, '')
}

export function normalizeProductSignal(input?: string | null) {
  if (!input) return null
  const cleaned = cleanupCategoryText(input)
  return findAliasMatch(cleaned, CANONICAL_PRODUCTS, PRODUCT_ALIAS_MAP) ?? cleaned
}

export function extractIntentSignals(productIntent: string) {
  const cleaned = cleanupCategoryText(productIntent)
  const brandSignal = findAliasMatch(cleaned, CANONICAL_BRANDS, BRAND_ALIAS_MAP)
  const productSignals = Array.from(
    new Set(
      tokenize(cleaned)
        .map((token) => PRODUCT_ALIAS_MAP.get(token))
        .filter((value): value is string => Boolean(value)),
    ),
  )

  const inlineProductSignal = findAliasMatch(cleaned, CANONICAL_PRODUCTS, PRODUCT_ALIAS_MAP)
  if (inlineProductSignal && !productSignals.includes(inlineProductSignal)) {
    productSignals.push(inlineProductSignal)
  }

  return {
    normalized_label: cleaned,
    brand_signal: brandSignal,
    product_signals: productSignals,
  }
}

export function classifyDiscoveredCategory(input: {
  raw_label: string
  category_path: string[]
  source_url: string
  context?: ClassificationContext
}) : ClassifiedCategory {
  const normalizedLabel = cleanupCategoryText(input.raw_label)
  const rawTokens = tokenize(input.raw_label)
  const pathTokens = input.category_path.flatMap((segment) => tokenize(segment))
  const productMatch = findAliasMatchDetailed(normalizedLabel, CANONICAL_PRODUCTS, PRODUCT_ALIAS_MAP)
  const brandMatch = findAliasMatchDetailed(normalizedLabel, CANONICAL_BRANDS, BRAND_ALIAS_MAP)
  const productSignal = productMatch?.canonical ?? null
  const directBrandSignal = brandMatch?.canonical ?? null

  let brandSignal = directBrandSignal
  let classificationMethod: ClassificationMethod = directBrandSignal || productSignal ? 'rules' : 'embedding'
  let brandConfidence = directBrandSignal ? 0.98 : 0
  const productConfidence = productSignal ? 0.95 : 0
  let embeddingBrandMatch: EmbeddingBrandMatch | null = null

  if (!brandSignal) {
    const embedded = rankBrandByEmbedding(normalizedLabel, productSignal)
    if (embedded?.similarity && embedded.similarity >= CLASSIFICATION_THRESHOLDS.embeddingBrandMinSimilarity) {
      brandSignal = embedded.canonical
      brandConfidence = embedded.similarity
      classificationMethod = 'embedding'
      embeddingBrandMatch = embedded
    }
  }

  let classificationStatus: ClassificationStatus = 'needs_review'
  let classificationConfidence = Math.max(brandConfidence, productConfidence, 0.35)
  let decisionReason = 'unresolved_label'
  let decisionReasonText = 'No confident brand or product normalization was found.'

  const repeatedLabelCount = input.context?.repeated_normalized_label_count ?? 1
  const repeatedWithinShopLabelCount = input.context?.repeated_within_shop_label_count ?? 1
  const repeatedSignalPairCount = input.context?.repeated_signal_pair_count ?? 1
  const hasExactProductAlias = productMatch?.match_type === 'exact'
  const hasExactBrandAlias = brandMatch?.match_type === 'exact'

  if (
    brandSignal &&
    productSignal &&
    brandConfidence >= CLASSIFICATION_THRESHOLDS.strictBrandProductAutoAccept
  ) {
    classificationStatus = 'auto_accepted'
    classificationConfidence = Math.min(0.99, (brandConfidence * 0.65) + (productConfidence * 0.35))
    decisionReason = hasExactBrandAlias && hasExactProductAlias
      ? 'exact_brand_product_alias'
      : 'high_confidence_brand_product'
    decisionReasonText = hasExactBrandAlias && hasExactProductAlias
      ? 'Exact brand and product aliases matched a canonical label.'
      : 'Brand and product signals cleared the strict auto-accept threshold.'
  } else if (
    brandSignal &&
    productSignal &&
    repeatedSignalPairCount >= 2 &&
    brandConfidence >= CLASSIFICATION_THRESHOLDS.repeatedBrandProductAutoAccept
  ) {
    classificationStatus = 'auto_accepted'
    classificationConfidence = Math.min(0.97, (brandConfidence * 0.6) + (productConfidence * 0.4))
    decisionReason = 'repeated_brand_product_consensus'
    decisionReasonText = 'Repeated matching brand and product labels in this mission raised confidence enough to auto-accept.'
  } else if (
    brandSignal &&
    !productSignal &&
    classificationMethod === 'rules' &&
    brandConfidence >= CLASSIFICATION_THRESHOLDS.directBrandOnlyAutoAccept
  ) {
    classificationStatus = 'auto_accepted'
    classificationConfidence = brandConfidence
    decisionReason = 'high_confidence_brand_only'
    decisionReasonText = 'An exact brand alias matched with high confidence.'
  } else if (
    !brandSignal &&
    productSignal &&
    hasExactProductAlias &&
    repeatedWithinShopLabelCount >= 2
  ) {
    classificationStatus = 'auto_accepted'
    classificationConfidence = Math.min(0.96, productConfidence)
    decisionReason = 'repeated_exact_product_only'
    decisionReasonText = 'This exact product-only label repeated within the same shop, so it was auto-accepted.'
  } else if (!brandSignal && productSignal) {
    classificationStatus = 'needs_review'
    classificationConfidence = Math.max(productConfidence * 0.8, 0.55)
    decisionReason = hasExactProductAlias
      ? 'product_only_needs_confirmation'
      : 'ambiguous_product_only_label'
    decisionReasonText = hasExactProductAlias
      ? 'The product normalized cleanly, but product-only labels still need confirmation unless they repeat within a shop.'
      : 'The label contains only a broad product cue, so it stays in manual review.'
  } else if (brandSignal && productSignal) {
    classificationStatus = 'needs_review'
    classificationConfidence = Math.max((brandConfidence * 0.7) + (productConfidence * 0.3), 0.6)
    decisionReason = classificationMethod === 'embedding'
      ? 'brand_product_below_strict_threshold'
      : 'brand_product_needs_confirmation'
    decisionReasonText = classificationMethod === 'embedding'
      ? 'Brand plus product were detected, but the brand confidence stayed below the balanced repeat threshold.'
      : 'Brand plus product were detected, but the combined confidence stayed below the auto-accept threshold.'
  } else if (brandSignal && !productSignal) {
    decisionReason = classificationMethod === 'embedding'
      ? 'embedding_brand_without_product'
      : 'brand_only_needs_confirmation'
    decisionReasonText = classificationMethod === 'embedding'
      ? 'An embedding-only brand guess without product support stays in review for this iteration.'
      : 'A brand-only label needs confirmation before it can affect downstream matching.'
  }

  const downstreamRefs = new Set<string>()
  if (productSignal && productConfidence >= 0.9) downstreamRefs.add(productSignal)
  if (brandSignal && classificationStatus === 'auto_accepted') downstreamRefs.add(brandSignal)

  return {
    normalized_label: normalizedLabel,
    brand_signal: brandSignal,
    product_signal: productSignal,
    classification_status: classificationStatus,
    classification_confidence: round4(classificationConfidence),
    classification_method: classificationMethod,
    display_label: buildDisplayLabel(brandSignal, productSignal, input.raw_label),
    evidence: {
      raw_label: input.raw_label,
      normalized_label: normalizedLabel,
      category_path: input.category_path,
      source_url: input.source_url,
      raw_tokens: rawTokens,
      path_tokens: pathTokens,
      decision_reason: decisionReason,
      decision_reason_text: decisionReasonText,
      matched_brand_alias: brandMatch?.matched_alias ?? null,
      matched_brand_alias_type: brandMatch?.match_type ?? null,
      matched_product_alias: productMatch?.matched_alias ?? null,
      matched_product_alias_type: productMatch?.match_type ?? null,
      embedding_score: embeddingBrandMatch ? round4(embeddingBrandMatch.similarity) : null,
      embedding_term: embeddingBrandMatch?.matched_term ?? null,
      repeated_within_mission_label: repeatedLabelCount >= 2,
      repeated_within_shop_label: repeatedWithinShopLabelCount >= 2,
      repeated_signal_pair: repeatedSignalPairCount >= 2,
      repeated_normalized_label_count: repeatedLabelCount,
      repeated_within_shop_label_count: repeatedWithinShopLabelCount,
      repeated_signal_pair_count: repeatedSignalPairCount,
      brand_confidence: round4(brandConfidence),
      product_confidence: round4(productConfidence),
      thresholds: CLASSIFICATION_THRESHOLDS,
    },
    downstream_refs: Array.from(downstreamRefs),
  }
}
