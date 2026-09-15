import {
  mineCandidateAliases,
  type ReviewDecisionInput,
} from './yupoo/classification.ts'

export interface MissionCategoryReviewItem {
  id: string
  mission_id: string
  group_key: string
  raw_label: string
  normalized_label: string
  display_label: string
  brand_signal: string | null
  product_signal: string | null
  classification_confidence: number | null
  classification_method: string | null
  classification_status: string
  decision_reason: string
  decision_reason_text: string
  occurrence_count: number
  category_ids: string[]
  preview_image_urls: string[]
  source_urls: string[]
  suggested_alias: ReviewAliasSuggestion | null
}

export interface MissionRowType {
  id: string
  product_intent: string
  seed_url: string
  destination_context: string | null
  status: string
  current_stage?: string | null
  queued_at?: string | null
  running_at?: string | null
  failed_at?: string | null
  attempt_count?: number
  last_error_message?: string | null
  last_error_code?: string | null
  created_at: string
  pending_classifications_count: number
  review_items: MissionCategoryReviewItem[]
}

export interface PendingCategoryReviewRow {
  mission_id: string
  source_category_id: string
  display_label: string
  canonical_brand: string | null
  canonical_product_type: string | null
  classification_confidence: number | null
  classification_method: string | null
  classification_status: string
  evidence: Record<string, unknown> | null
  source_category: {
    preview_image_urls: string[] | null
    source_url: string | null
  } | null
}

export type ReviewAliasSuggestion = {
  variant: string
  canonical: string
  score: number
  evidence: {
    source: 'review_consensus' | 'brand_signal_confirmation'
    observations: number
    approvals: number
    rejections: number
  }
}

function getShopOrigin(url: string | null | undefined) {
  if (!url) return 'unknown'
  try {
    return new URL(url).origin
  } catch {
    return url
  }
}

export type CategoryStrategyInputRow = {
  mission_id: string
  source_category_id: string
  source_url: string | null
  raw_label: string
  normalized_label: string | null
  canonical_brand: string | null
  canonical_product_type: string | null
  display_label: string
  classification_status: string
  classification_confidence: number | null
}

export type CategoryStrategyGroup = {
  group_key: string
  canonical_brand: string | null
  canonical_product_type: string | null
  display_label: string
  member_count: number
  mission_ids: string[]
  shop_origins: string[]
  raw_variants: string[]
  status_counts: Record<string, number>
  max_confidence: number
  avg_confidence: number
  priority_score: number
  priority_rank: number
}

function strategyGroupKey(row: CategoryStrategyInputRow) {
  if (row.canonical_brand || row.canonical_product_type) {
    return [row.canonical_brand ?? '', row.canonical_product_type ?? ''].join('::')
  }
  return `unresolved::${(row.normalized_label ?? row.display_label).toLowerCase()}`
}

export function rollupCategoryStrategy(rows: CategoryStrategyInputRow[]): CategoryStrategyGroup[] {
  const membersByKey = new Map<string, CategoryStrategyInputRow[]>()
  rows.forEach((row) => {
    const key = strategyGroupKey(row)
    membersByKey.set(key, [...(membersByKey.get(key) ?? []), row])
  })

  const groups = Array.from(membersByKey.entries()).map(([group_key, members]) => {
    const missionIds = Array.from(new Set(members.map((member) => member.mission_id))).sort()
    const shopOrigins = Array.from(
      new Set(members.map((member) => getShopOrigin(member.source_url))),
    ).sort()
    const rawVariants = Array.from(
      new Set(members.map((member) => member.raw_label.trim()).filter(Boolean)),
    ).sort()
    const statusCounts: Record<string, number> = {}
    members.forEach((member) => {
      statusCounts[member.classification_status] = (statusCounts[member.classification_status] ?? 0) + 1
    })
    const confidences = members.map((member) => Number(member.classification_confidence ?? 0))
    const maxConfidence = Math.max(0, ...confidences)
    const [topMember] = [...members].sort(
      (left, right) => Number(right.classification_confidence ?? 0) - Number(left.classification_confidence ?? 0),
    )
    const [first] = members
    return {
      group_key,
      canonical_brand: first?.canonical_brand ?? null,
      canonical_product_type: first?.canonical_product_type ?? null,
      display_label: topMember?.display_label ?? first?.display_label ?? group_key,
      member_count: members.length,
      mission_ids: missionIds,
      shop_origins: shopOrigins,
      raw_variants: rawVariants,
      status_counts: statusCounts,
      max_confidence: Math.round(maxConfidence * 10000) / 10000,
      avg_confidence:
        Math.round((confidences.reduce((total, value) => total + value, 0) / Math.max(1, confidences.length)) * 10000) / 10000,
      priority_score: shopOrigins.length * 100 + members.length * 10 + maxConfidence,
      priority_rank: 0,
    }
  })

  groups.sort((left, right) => right.priority_score - left.priority_score || (left.group_key < right.group_key ? -1 : 1))
  groups.forEach((group, index) => {
    group.priority_rank = index + 1
  })
  return groups
}

export type DiscoveredCategoryReviewSource = {
  id: string
  mission_id: string
  raw_label: string
  normalized_label: string | null
  brand_signal: string | null
  product_signal: string | null
  classification_confidence: number | null
  classification_method: string | null
  classification_status: string
  preview_image_urls: string[] | null
  source_url: string | null
}

export function buildKnownAliasForms(
  brands: Array<{ name: string; slug: string; brand_aliases?: Array<{ alias: string }> | null }>,
) {
  return brands.flatMap((brand) => [
    brand.name,
    brand.slug,
    ...((brand.brand_aliases ?? []).map((alias) => alias.alias)),
  ])
}

export function toPendingCategoryReviewRows(rows: DiscoveredCategoryReviewSource[]): PendingCategoryReviewRow[] {
  return rows.map((row) => ({
    mission_id: row.mission_id,
    source_category_id: row.id,
    display_label: [row.brand_signal?.toUpperCase(), row.product_signal].filter(Boolean).join(' ') || row.raw_label,
    canonical_brand: row.brand_signal,
    canonical_product_type: row.product_signal,
    classification_confidence: row.classification_confidence,
    classification_method: row.classification_method,
    classification_status: row.classification_status,
    evidence: {
      raw_label: row.raw_label,
      normalized_label: row.normalized_label ?? row.raw_label,
      decision_reason: 'needs_review',
    },
    source_category: {
      preview_image_urls: row.preview_image_urls,
      source_url: row.source_url,
    },
  }))
}

export type StoredReviewDecision = {
  canonical_brand: string | null
  evidence: unknown
}

export function toReviewDecisions(rows: StoredReviewDecision[]): ReviewDecisionInput[] {
  return rows
    .map((row) => {
      const evidence = (row.evidence ?? {}) as { raw_label?: unknown; decision?: unknown }
      const decision = evidence.decision === 'accept' || evidence.decision === 'edit' || evidence.decision === 'reject'
        ? evidence.decision
        : null
      if (!decision || typeof evidence.raw_label !== 'string') return null
      return { raw_label: evidence.raw_label, decision, brand_signal: row.canonical_brand }
    })
    .filter((decision): decision is ReviewDecisionInput => decision !== null)
}

export function attachSuggestedReviewAliases(
  items: MissionCategoryReviewItem[],
  decisions: ReviewDecisionInput[] = [],
  knownAliasForms: string[] = [],
): MissionCategoryReviewItem[] {
  const known = new Set(knownAliasForms.map((form) => form.toLowerCase()))
  const candidates = mineCandidateAliases(
    items.map((item) => item.raw_label),
    decisions,
  )
  const candidateByVariant = new Map(candidates.map((candidate) => [candidate.variant.toLowerCase(), candidate]))

  return items.map((item) => {
    const variant = item.raw_label.trim()
    if (!variant || known.has(variant.toLowerCase())) {
      return { ...item, suggested_alias: null }
    }

    const candidate = candidateByVariant.get(variant.toLowerCase())
    if (candidate) {
      return {
        ...item,
        suggested_alias: {
          variant: candidate.variant,
          canonical: candidate.canonical,
          score: candidate.score,
          evidence: {
            source: 'review_consensus' as const,
            observations: candidate.evidence.observations,
            approvals: candidate.evidence.approvals,
            rejections: candidate.evidence.rejections,
          },
        },
      }
    }

    if (item.brand_signal) {
      return {
        ...item,
        suggested_alias: {
          variant,
          canonical: item.brand_signal,
          score: item.occurrence_count,
          evidence: {
            source: 'brand_signal_confirmation' as const,
            observations: item.occurrence_count,
            approvals: 0,
            rejections: 0,
          },
        },
      }
    }

    return { ...item, suggested_alias: null }
  })
}

const MAX_REVIEW_PREVIEW_IMAGES = 4

export function mergePreviewImageUrls(...groups: Array<string[] | null | undefined>) {
  const merged: string[] = []
  const seen = new Set<string>()

  for (const group of groups) {
    for (const url of group ?? []) {
      if (seen.has(url)) continue
      seen.add(url)
      merged.push(url)
      if (merged.length >= MAX_REVIEW_PREVIEW_IMAGES) return merged
    }
  }

  return merged
}

export function groupMissionCategoryReviewItems(rows: PendingCategoryReviewRow[]) {
  return rows.reduce<Record<string, MissionCategoryReviewItem[]>>((accumulator, row) => {
    const evidence = row.evidence ?? {}
    const groupKey = [
      row.mission_id,
      String(evidence.normalized_label ?? row.display_label),
      row.canonical_brand ?? '',
      row.canonical_product_type ?? '',
      String(evidence.decision_reason ?? ''),
    ].join('::')

    accumulator[row.mission_id] ??= []

    const existingGroup = accumulator[row.mission_id]?.find((item) => item.group_key === groupKey)
    const previewImageUrls = row.source_category?.preview_image_urls ?? []

    if (existingGroup) {
      existingGroup.occurrence_count += 1
      existingGroup.category_ids.push(row.source_category_id)
      if (row.source_category?.source_url && !existingGroup.source_urls.includes(row.source_category.source_url)) {
        existingGroup.source_urls.push(row.source_category.source_url)
      }
      existingGroup.preview_image_urls = mergePreviewImageUrls(
        existingGroup.preview_image_urls,
        previewImageUrls,
      )
      return accumulator
    }

    accumulator[row.mission_id]?.push({
      id: row.source_category_id,
      mission_id: row.mission_id,
      group_key: groupKey,
      raw_label: String(evidence.raw_label ?? row.display_label),
      normalized_label: String(evidence.normalized_label ?? row.display_label),
      display_label: row.display_label,
      brand_signal: row.canonical_brand,
      product_signal: row.canonical_product_type,
      classification_confidence: row.classification_confidence,
      classification_method: row.classification_method,
      classification_status: row.classification_status,
      decision_reason: String(evidence.decision_reason ?? 'needs_review'),
      decision_reason_text: String(
        evidence.decision_reason_text ?? 'This label still needs manual review before matching can run.',
      ),
      occurrence_count: 1,
      category_ids: [row.source_category_id],
      preview_image_urls: mergePreviewImageUrls(previewImageUrls),
      source_urls: row.source_category?.source_url ? [row.source_category.source_url] : [],
      suggested_alias: null,
    })
    return accumulator
  }, {})
}
