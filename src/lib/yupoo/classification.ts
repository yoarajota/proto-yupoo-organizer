import {
  CANONICAL_BRANDS,
  CANONICAL_PRODUCTS,
  type CanonicalBrand,
  type CanonicalProduct,
} from './category-config.ts'
import type {
  ClassificationMethod,
  ClassificationStatus,
} from '../schemas/sourcing-classification.ts'
import {
  CATALOG_EMBEDDING_BRAND_THRESHOLD,
  CATALOG_EMBEDDING_PRODUCT_THRESHOLD,
  cleanCatalogEmbeddingText,
  type CatalogEmbeddingMatch,
} from '../catalog-embeddings.ts'

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
  canonical_brands?: CanonicalBrand[]
  canonical_products?: CanonicalProduct[]
  embedding_brand_match?: CatalogEmbeddingMatch | null
  embedding_product_match?: CatalogEmbeddingMatch | null
}

type AliasMatch<TCanonical extends string = string> = {
  canonical: TCanonical
  matched_alias: string
  match_type: 'exact' | 'contains'
}

const CLASSIFICATION_THRESHOLDS = {
  directBrandOnlyAutoAccept: 0.9,
  embeddingBrandMinSimilarity: CATALOG_EMBEDDING_BRAND_THRESHOLD,
  repeatedBrandProductAutoAccept: 0.74,
  strictBrandProductAutoAccept: 0.82,
  embeddingProductMinSimilarity: CATALOG_EMBEDDING_PRODUCT_THRESHOLD,
} as const

function round4(value: number) {
  return Math.round(value * 10000) / 10000
}

export function cleanupCategoryText(input: string) {
  return cleanCatalogEmbeddingText(input)
}

function tokenize(input: string) {
  return cleanupCategoryText(input)
    .split(/\s+/)
    .filter(Boolean)
}

function buildAliasMap<T extends { canonical: string; aliases: string[] }>(entries: T[]) {
  const map = new Map<string, string>()
  const setOnce = (key: string, canonical: string) => {
    if (!key) return
    if (!map.has(key)) map.set(key, canonical)
  }
  entries.forEach((entry) => {
    setOnce(cleanupCategoryText(entry.canonical), entry.canonical)
    entry.aliases.forEach((alias) => {
      const cleanedAlias = cleanupCategoryText(alias)
      if (!cleanedAlias) return
      setOnce(cleanedAlias, entry.canonical)
      setOnce(cleanedAlias.replace(/\s+/g, ''), entry.canonical)
    })
  })
  return map
}

function mergeCatalogEntries<T extends { canonical: string }>(
  fallbackEntries: T[],
  catalogEntries?: T[],
) {
  if (!catalogEntries || catalogEntries.length === 0) return fallbackEntries

  const merged = new Map<string, T>()
  fallbackEntries.forEach((entry) => merged.set(entry.canonical, entry))
  catalogEntries.forEach((entry) => merged.set(entry.canonical, entry))
  return Array.from(merged.values())
}

function findAliasMatchDetailed<T extends CanonicalBrand | CanonicalProduct>(
  cleaned: string,
  entries: T[],
  aliasMap: Map<string, string>,
): AliasMatch<T['canonical']> | null {
  if (!cleaned) return null
  const compact = cleaned.replace(/\s+/g, '')
  const direct = aliasMap.get(cleaned) ?? (compact ? aliasMap.get(compact) : undefined)

  if (direct) {
    return {
      canonical: direct as T['canonical'],
      matched_alias: cleaned,
      match_type: 'exact',
    }
  }

  let best: AliasMatch<T['canonical']> | null = null
  const tokens = new Set(cleaned.split(/\s+/).filter(Boolean))
  for (const entry of entries) {
    const candidates = [entry.canonical, ...entry.aliases]
      .map(cleanupCategoryText)
      .filter(Boolean)
    for (const candidate of candidates) {
      if (!cleaned.includes(candidate)) continue
      // Short aliases surface as substrings of unrelated words ("pa" in
      // "company", "tb" in "montbell"), so they only match whole tokens.
      const compactCandidate = candidate.replace(/\s+/g, '')
      if (compactCandidate.length <= 2 && !tokens.has(candidate) && !tokens.has(compactCandidate)) continue
      if (!best || candidate.length > best.matched_alias.length) {
        best = {
          canonical: entry.canonical as T['canonical'],
          matched_alias: candidate,
          match_type: 'contains',
        }
      }
    }
  }

  return best
}

function findAliasMatch(
  cleaned: string,
  entries: Array<CanonicalBrand | CanonicalProduct>,
  aliasMap: Map<string, string>,
) {
  return findAliasMatchDetailed(cleaned, entries, aliasMap)?.canonical ?? null
}

function lookupBrandDisplay(canonical: string | null, brandEntries: CanonicalBrand[] = CANONICAL_BRANDS) {
  if (!canonical) return null
  return brandEntries.find((brand) => brand.canonical === canonical)?.display ?? canonical.toUpperCase()
}

function lookupProductDisplay(
  canonical: string | null,
  productEntries: CanonicalProduct[] = CANONICAL_PRODUCTS,
) {
  if (!canonical) return null
  return productEntries.find((product) => product.canonical === canonical)?.display ?? canonical
}

function buildDisplayLabel(
  brandSignal: string | null,
  productSignal: string | null,
  fallback: string,
  brandEntries: CanonicalBrand[] = CANONICAL_BRANDS,
  productEntries: CanonicalProduct[] = CANONICAL_PRODUCTS,
) {
  const brandDisplay = lookupBrandDisplay(brandSignal, brandEntries)
  const productDisplay = lookupProductDisplay(productSignal, productEntries)
  const combined = [brandDisplay, productDisplay].filter(Boolean).join(' ')
  return combined || fallback
}

export function normalizeBrandSignal(
  input?: string | null,
  brandEntries: CanonicalBrand[] = CANONICAL_BRANDS,
) {
  if (!input) return null
  const entries = mergeCatalogEntries(CANONICAL_BRANDS, brandEntries)
  const cleaned = cleanupCategoryText(input)
  return findAliasMatch(cleaned, entries, buildAliasMap(entries)) ?? cleaned.replace(/\s+/g, '')
}

export function normalizeProductSignal(
  input?: string | null,
  productEntries: CanonicalProduct[] = CANONICAL_PRODUCTS,
) {
  if (!input) return null
  const entries = mergeCatalogEntries(CANONICAL_PRODUCTS, productEntries)
  const cleaned = cleanupCategoryText(input)
  return findAliasMatch(cleaned, entries, buildAliasMap(entries)) ?? cleaned
}

export function extractIntentSignals(
  productIntent: string,
  context?: Pick<ClassificationContext, 'canonical_brands' | 'canonical_products'>,
) {
  const brandEntries = mergeCatalogEntries(CANONICAL_BRANDS, context?.canonical_brands)
  const productEntries = mergeCatalogEntries(CANONICAL_PRODUCTS, context?.canonical_products)
  const brandAliasMap = buildAliasMap(brandEntries)
  const productAliasMap = buildAliasMap(productEntries)
  const cleaned = cleanupCategoryText(productIntent)
  const brandSignal = findAliasMatch(cleaned, brandEntries, brandAliasMap)
  const productSignals = Array.from(
    new Set(
      tokenize(cleaned)
        .map((token) => productAliasMap.get(token))
        .filter((value): value is string => Boolean(value)),
    ),
  )

  const inlineProductSignal = findAliasMatch(cleaned, productEntries, productAliasMap)
  if (inlineProductSignal && !productSignals.includes(inlineProductSignal)) {
    productSignals.push(inlineProductSignal)
  }

  for (const entry of productEntries) {
    if (productSignals.includes(entry.canonical)) continue
    const multiWordHit = [entry.canonical, ...entry.aliases]
      .map(cleanupCategoryText)
      .some((candidate) => candidate.includes(' ') && cleaned.includes(candidate))
    if (multiWordHit) productSignals.push(entry.canonical)
  }

  return {
    normalized_label: cleaned,
    brand_signal: brandSignal,
    product_signals: productSignals,
  }
}

export type ReviewDecisionInput = {
  raw_label: string
  decision: 'accept' | 'edit' | 'reject'
  brand_signal: string | null
}

export type MinedAliasCandidate = {
  variant: string
  canonical: string
  score: number
  evidence: {
    observations: number
    approvals: number
    rejections: number
    cleaned_variant: string
    source: 'review_consensus'
  }
}

export function mineCandidateAliases(
  rawLabels: string[],
  reviewDecisions: ReviewDecisionInput[],
  brandEntries: CanonicalBrand[] = CANONICAL_BRANDS,
): MinedAliasCandidate[] {
  const knownRawForms = new Set<string>()
  brandEntries.forEach((entry) => {
    knownRawForms.add(entry.canonical.toLowerCase())
    knownRawForms.add(entry.display.toLowerCase())
    entry.aliases.forEach((alias) => knownRawForms.add(alias.toLowerCase()))
  })

  const observations = new Map<string, number>()
  rawLabels.forEach((rawLabel) => {
    const variant = rawLabel.trim()
    if (!variant) return
    observations.set(variant, (observations.get(variant) ?? 0) + 1)
  })

  const approvalsByVariant = new Map<string, string[]>()
  const rejectionsByVariant = new Map<string, number>()
  reviewDecisions.forEach((decision) => {
    const variant = decision.raw_label.trim()
    if (!variant) return
    if (decision.decision === 'reject' || !decision.brand_signal) {
      rejectionsByVariant.set(variant, (rejectionsByVariant.get(variant) ?? 0) + 1)
      return
    }
    const approvals = approvalsByVariant.get(variant) ?? []
    approvals.push(decision.brand_signal)
    approvalsByVariant.set(variant, approvals)
  })

  const candidates: MinedAliasCandidate[] = []
  approvalsByVariant.forEach((approvals, variant) => {
    if (knownRawForms.has(variant.toLowerCase())) return
    const rejections = rejectionsByVariant.get(variant) ?? 0
    if (approvals.length <= rejections) return

    const votes = new Map<string, number>()
    approvals.forEach((canonical) => votes.set(canonical, (votes.get(canonical) ?? 0) + 1))
    const canonical = Array.from(votes.entries()).sort(
      (left, right) => right[1] - left[1] || (left[0] < right[0] ? -1 : 1),
    )[0][0]
    const approvalCount = votes.get(canonical) ?? approvals.length

    candidates.push({
      variant,
      canonical,
      score: approvalCount * 2 + (observations.get(variant) ?? 0) - rejections,
      evidence: {
        observations: observations.get(variant) ?? 0,
        approvals: approvalCount,
        rejections,
        cleaned_variant: cleanupCategoryText(variant),
        source: 'review_consensus',
      },
    })
  })

  return candidates.sort(
    (left, right) => right.score - left.score || (left.variant < right.variant ? -1 : 1),
  )
}

export function classifyDiscoveredCategory(input: {
  raw_label: string
  category_path: string[]
  source_url: string
  context?: ClassificationContext
}): ClassifiedCategory {
  const brandEntries = mergeCatalogEntries(CANONICAL_BRANDS, input.context?.canonical_brands)
  const productEntries = mergeCatalogEntries(CANONICAL_PRODUCTS, input.context?.canonical_products)
  const brandAliasMap = buildAliasMap(brandEntries)
  const productAliasMap = buildAliasMap(productEntries)
  const normalizedLabel = cleanupCategoryText(input.raw_label)
  const rawTokens = tokenize(input.raw_label)
  const pathTokens = input.category_path.flatMap((segment) => tokenize(segment))
  const productMatch = findAliasMatchDetailed(normalizedLabel, productEntries, productAliasMap)
  const brandMatch = findAliasMatchDetailed(normalizedLabel, brandEntries, brandAliasMap)
  let productSignal = productMatch?.canonical ?? null
  const directBrandSignal = brandMatch?.canonical ?? null

  let brandSignal = directBrandSignal
  let classificationMethod: ClassificationMethod = directBrandSignal || productSignal ? 'rules' : 'embedding'
  let brandConfidence = directBrandSignal ? 0.98 : 0
  let productConfidence = productSignal ? 0.95 : 0
  let embeddingBrandMatch: CatalogEmbeddingMatch | null = null
  let embeddingProductMatch: CatalogEmbeddingMatch | null = null
  const embeddingEligible = normalizedLabel.replace(/\s+/g, '').length > 3

  if (!brandSignal && embeddingEligible) {
    const embedded = input.context?.embedding_brand_match ?? null
    if (
      embedded?.similarity &&
      embedded.similarity >= CLASSIFICATION_THRESHOLDS.embeddingBrandMinSimilarity
    ) {
      brandSignal = embedded.canonical_slug
      brandConfidence = embedded.similarity
      classificationMethod = 'embedding'
      embeddingBrandMatch = embedded
    }
  }

  if (!productSignal && embeddingEligible) {
    const embeddedProduct = input.context?.embedding_product_match ?? null
    if (
      embeddedProduct?.similarity &&
      embeddedProduct.similarity >= CLASSIFICATION_THRESHOLDS.embeddingProductMinSimilarity
    ) {
      productSignal = embeddedProduct.canonical_slug
      productConfidence = embeddedProduct.similarity
      classificationMethod = 'embedding'
      embeddingProductMatch = embeddedProduct
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
    display_label: buildDisplayLabel(brandSignal, productSignal, input.raw_label, brandEntries, productEntries),
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
      embedding_term: embeddingBrandMatch?.source_text ?? null,
      embedding_entity_type: embeddingBrandMatch?.entity_type ?? null,
      embedding_source_id: embeddingBrandMatch?.entity_id ?? null,
      embedding_threshold: embeddingBrandMatch?.threshold ?? null,
      embedding_product_score: embeddingProductMatch ? round4(embeddingProductMatch.similarity) : null,
      embedding_product_term: embeddingProductMatch?.source_text ?? null,
      embedding_product_entity_type: embeddingProductMatch?.entity_type ?? null,
      embedding_product_source_id: embeddingProductMatch?.entity_id ?? null,
      embedding_product_threshold: embeddingProductMatch?.threshold ?? null,
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
