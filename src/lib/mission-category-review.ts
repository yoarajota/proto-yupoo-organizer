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
    })
    return accumulator
  }, {})
}
