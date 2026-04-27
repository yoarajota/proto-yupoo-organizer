'use server'

import { revalidatePath } from 'next/cache'
import { writeAgentRunArtifact } from '@/lib/agent-logs'
import { createClient } from '@/lib/supabase/server'
import {
  ReviewMissionCategoryClassificationSchema,
  RunMissionCategoryClassificationSchema,
  type ReviewMissionCategoryClassificationValues,
  type RunMissionCategoryClassificationValues,
} from '@/lib/schemas/sourcing-classification'
import {
  classifyDiscoveredCategory,
  cleanupCategoryText,
  normalizeBrandSignal,
  normalizeProductSignal,
} from '@/lib/yupoo/classification'

type CategoryRow = {
  id: string
  mission_id: string
  source_url: string
  category_path: string[]
  raw_label: string
  brand_signal: string | null
  product_signal: string | null
  classification_status: 'auto_accepted' | 'needs_review' | 'reviewed'
  classification_confidence: number | null
}

type ClassificationSourceRow = {
  id: string
  mission_id: string
  source_url: string
  category_path: string[]
  raw_label: string
}

type ClassifiedRow = {
  source: ClassificationSourceRow
  result: ReturnType<typeof classifyDiscoveredCategory>
}

function getOrigin(url: string) {
  try {
    return new URL(url).origin
  } catch {
    return url
  }
}

function buildDisplayLabel(brand: string | null, product: string | null, fallback: string) {
  const brandDisplay = brand ? brand.toUpperCase() : null
  const productDisplay = product
    ? product.charAt(0).toUpperCase() + product.slice(1)
    : null
  return [brandDisplay, productDisplay].filter(Boolean).join(' ') || fallback
}

function incrementBucket(bucket: Record<string, number>, key: string | null | undefined) {
  const resolvedKey = key || 'unknown'
  bucket[resolvedKey] = (bucket[resolvedKey] ?? 0) + 1
}

function buildClassificationDiagnostics(classified: ClassifiedRow[]) {
  const uniqueNormalizedLabels = new Set<string>()
  const duplicateLabelsByMission = new Map<string, number>()
  const duplicateLabelsByShop = new Map<string, number>()
  const autoAcceptedByMethod: Record<string, number> = {}
  const autoAcceptedByReason: Record<string, number> = {}
  const needsReviewByReason: Record<string, number> = {}

  classified.forEach(({ source, result }) => {
    uniqueNormalizedLabels.add(result.normalized_label)

    const repeatedLabelCount = Number(result.evidence.repeated_normalized_label_count ?? 1)
    const repeatedWithinShopCount = Number(result.evidence.repeated_within_shop_label_count ?? 1)
    const decisionReason = String(result.evidence.decision_reason ?? 'unknown')

    if (repeatedLabelCount >= 2) {
      duplicateLabelsByMission.set(
        result.normalized_label,
        Math.max(duplicateLabelsByMission.get(result.normalized_label) ?? 0, repeatedLabelCount),
      )
    }

    if (repeatedWithinShopCount >= 2) {
      const shopKey = `${getOrigin(source.source_url)}::${result.normalized_label}`
      duplicateLabelsByShop.set(
        shopKey,
        Math.max(duplicateLabelsByShop.get(shopKey) ?? 0, repeatedWithinShopCount),
      )
    }

    if (result.classification_status === 'auto_accepted') {
      incrementBucket(autoAcceptedByMethod, result.classification_method)
      incrementBucket(autoAcceptedByReason, decisionReason)
      return
    }

    if (result.classification_status === 'needs_review') {
      incrementBucket(needsReviewByReason, decisionReason)
    }
  })

  return {
    total_categories_scanned: classified.length,
    unique_normalized_labels: uniqueNormalizedLabels.size,
    duplicate_labels_by_mission: Array.from(duplicateLabelsByMission.entries()).map(([label, count]) => ({
      normalized_label: label,
      occurrences: count,
    })),
    duplicate_labels_by_shop: Array.from(duplicateLabelsByShop.entries()).map(([key, count]) => {
      const [shop_origin, normalized_label] = key.split('::')
      return {
        shop_origin,
        normalized_label,
        occurrences: count,
      }
    }),
    auto_accepted_count_by_method: autoAcceptedByMethod,
    auto_accepted_count_by_reason: autoAcceptedByReason,
    needs_review_count_by_reason: needsReviewByReason,
  }
}

async function refreshSupplierClassificationRefs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  missionId: string,
) {
  const { data: suppliers, error: suppliersError } = await supabase
    .from('discovered_suppliers')
    .select('id, source_url, category_refs, normalized_category_refs')
    .eq('mission_id', missionId)

  if (suppliersError) throw new Error(suppliersError.message)

  const { data: categories, error: categoriesError } = await supabase
    .from('discovered_categories')
    .select(
      'id, source_url, brand_signal, product_signal, classification_status, classification_confidence',
    )
    .eq('mission_id', missionId)

  if (categoriesError) throw new Error(categoriesError.message)

  const categoryRows = (categories ?? []) as Array<{
    source_url: string
    brand_signal: string | null
    product_signal: string | null
    classification_status: 'auto_accepted' | 'needs_review' | 'reviewed'
  }>

  const updates = (suppliers ?? []).map((supplier) => {
    const supplierOrigin = getOrigin(supplier.source_url)
    const refs = new Set<string>()

    categoryRows
      .filter((category) => getOrigin(category.source_url) === supplierOrigin)
      .forEach((category) => {
        if (category.product_signal) refs.add(category.product_signal)
        if (
          category.brand_signal &&
          (category.classification_status === 'auto_accepted' ||
            category.classification_status === 'reviewed')
        ) {
          refs.add(category.brand_signal)
        }
      })

    return {
      id: supplier.id,
      normalized_category_refs: Array.from(refs),
    }
  })

  if (updates.length === 0) return 0

  const { error: updateError } = await supabase
    .from('discovered_suppliers')
    .upsert(updates, { onConflict: 'id' })

  if (updateError) throw new Error(updateError.message)

  return updates.filter((update) => update.normalized_category_refs.length > 0).length
}

async function updateMissionStatusFromPendingReviews(
  supabase: Awaited<ReturnType<typeof createClient>>,
  missionId: string,
) {
  const { data: categories, error } = await supabase
    .from('discovered_categories')
    .select('id, classification_status')
    .eq('mission_id', missionId)

  if (error) throw new Error(error.message)

  const pendingReviews = (categories ?? []).filter(
    (category) => category.classification_status === 'needs_review',
  ).length

  const status = pendingReviews === 0 ? 'matching' : 'classifying_categories'

  const { error: statusError } = await supabase
    .from('sourcing_missions')
    .update({ status })
    .eq('id', missionId)

  if (statusError) throw new Error(statusError.message)

  return {
    mission_status: status,
    pending_reviews_count: pendingReviews,
  }
}

export async function runMissionCategoryClassification(input: RunMissionCategoryClassificationValues) {
  const parsed = RunMissionCategoryClassificationSchema.safeParse(input)
  if (!parsed.success) return { data: null, error: { message: 'Invalid classification payload.' } }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: { message: 'Unauthorized' } }

  const startedAt = new Date().toISOString()

  const { error: missionStatusError } = await supabase
    .from('sourcing_missions')
    .update({ status: 'classifying_categories' })
    .eq('id', parsed.data.mission_id)

  if (missionStatusError) return { data: null, error: { message: missionStatusError.message } }

  const { error: stageInsertError } = await supabase
    .from('sourcing_mission_stage_metrics')
    .insert({
      mission_id: parsed.data.mission_id,
      stage_name: 'classifying_categories',
      started_at: startedAt,
    })

  if (stageInsertError) return { data: null, error: { message: stageInsertError.message } }

  const { data: discoveredCategories, error: categoriesError } = await supabase
    .from('discovered_categories')
    .select('id, mission_id, source_url, category_path, raw_label')
    .eq('mission_id', parsed.data.mission_id)

  if (categoriesError) return { data: null, error: { message: categoriesError.message } }

  const categoryRows = (discoveredCategories ?? []) as ClassificationSourceRow[]

  const normalizedLabelCounts = new Map<string, number>()
  const normalizedLabelCountsByShop = new Map<string, number>()
  const repeatedSignalPairCounts = new Map<string, number>()

  const baseClassified = categoryRows.map((category) => {
    const baseResult = classifyDiscoveredCategory(category)
    normalizedLabelCounts.set(
      baseResult.normalized_label,
      (normalizedLabelCounts.get(baseResult.normalized_label) ?? 0) + 1,
    )

    const shopLabelKey = `${getOrigin(category.source_url)}::${baseResult.normalized_label}`
    normalizedLabelCountsByShop.set(
      shopLabelKey,
      (normalizedLabelCountsByShop.get(shopLabelKey) ?? 0) + 1,
    )

    if (baseResult.brand_signal && baseResult.product_signal) {
      const signalPairKey = `${baseResult.brand_signal}::${baseResult.product_signal}`
      repeatedSignalPairCounts.set(
        signalPairKey,
        (repeatedSignalPairCounts.get(signalPairKey) ?? 0) + 1,
      )
    }

    return {
      source: category,
      baseResult,
    }
  })

  const classified = baseClassified.map(({ source, baseResult }) => ({
    source,
    result: classifyDiscoveredCategory({
      ...source,
      context: {
        repeated_normalized_label_count: normalizedLabelCounts.get(baseResult.normalized_label) ?? 1,
        repeated_within_shop_label_count:
          normalizedLabelCountsByShop.get(`${getOrigin(source.source_url)}::${baseResult.normalized_label}`) ?? 1,
        repeated_signal_pair_count:
          baseResult.brand_signal && baseResult.product_signal
            ? repeatedSignalPairCounts.get(`${baseResult.brand_signal}::${baseResult.product_signal}`) ?? 1
            : 1,
      },
    }),
  }))

  const diagnostics = buildClassificationDiagnostics(classified)

  if (classified.length > 0) {
    const { error: discoveredUpdateError } = await supabase
      .from('discovered_categories')
      .upsert(
        classified.map(({ source, result }) => ({
          id: source.id,
          mission_id: source.mission_id,
          source_url: source.source_url,
          category_path: source.category_path,
          raw_label: source.raw_label,
          normalized_label: result.normalized_label,
          brand_signal: result.brand_signal,
          product_signal: result.product_signal,
          classification_status: result.classification_status,
          classification_confidence: result.classification_confidence,
          classification_method: result.classification_method,
        })),
        { onConflict: 'id' },
      )

    if (discoveredUpdateError) return { data: null, error: { message: discoveredUpdateError.message } }

    const { error: normalizedUpsertError } = await supabase
      .from('mission_category_classifications')
      .upsert(
        classified.map(({ source, result }) => ({
          mission_id: source.mission_id,
          source_category_id: source.id,
          canonical_brand: result.brand_signal,
          canonical_product_type: result.product_signal,
          display_label: result.display_label,
          evidence: result.evidence,
          classification_status: result.classification_status,
          classification_confidence: result.classification_confidence,
          classification_method: result.classification_method,
        })),
        { onConflict: 'mission_id,source_category_id' },
      )

    if (normalizedUpsertError) return { data: null, error: { message: normalizedUpsertError.message } }
  }

  let normalizedSupplierRefsUpdated = 0
  let missionStatus = 'classifying_categories'
  let pendingReviewsCount = 0

  try {
    normalizedSupplierRefsUpdated = await refreshSupplierClassificationRefs(
      supabase,
      parsed.data.mission_id,
    )

    const statusResult = await updateMissionStatusFromPendingReviews(
      supabase,
      parsed.data.mission_id,
    )
    missionStatus = statusResult.mission_status
    pendingReviewsCount = statusResult.pending_reviews_count
  } catch (error) {
    return {
      data: null,
      error: { message: error instanceof Error ? error.message : 'Classification refresh failed.' },
    }
  }

  const finishedAt = new Date().toISOString()

  try {
    await writeAgentRunArtifact('classification', parsed.data.mission_id, startedAt, {
      finished_at: finishedAt,
      mission_status: missionStatus,
      pending_reviews_count: pendingReviewsCount,
      normalized_supplier_refs_updated: normalizedSupplierRefsUpdated,
      thresholds_used: classified[0]?.result.evidence.thresholds ?? null,
      diagnostics,
      categories: classified.map(({ source, result }) => ({
        source_category_id: source.id,
        source_url: source.source_url,
        shop_origin: getOrigin(source.source_url),
        raw_label: source.raw_label,
        normalized_input_label: cleanupCategoryText(source.raw_label),
        category_path: source.category_path,
        normalized_output_label: result.normalized_label,
        canonical_brand: result.brand_signal,
        canonical_product_type: result.product_signal,
        classification_status: result.classification_status,
        classification_confidence: result.classification_confidence,
        classification_method: result.classification_method,
        acceptance_reason:
          result.classification_status === 'auto_accepted'
            ? result.evidence.decision_reason
            : null,
        review_reason:
          result.classification_status === 'needs_review'
            ? result.evidence.decision_reason
            : null,
        decision_reason_text: result.evidence.decision_reason_text,
        dedupe_signals: {
          repeated_within_mission_label: result.evidence.repeated_within_mission_label,
          repeated_within_shop_label: result.evidence.repeated_within_shop_label,
          repeated_signal_pair: result.evidence.repeated_signal_pair,
        },
        evidence: result.evidence,
      })),
    })
  } catch (error) {
    console.error('Failed to write classification artifact', error)
  }

  const { error: stageFinishError } = await supabase
    .from('sourcing_mission_stage_metrics')
    .update({ finished_at: finishedAt })
    .eq('mission_id', parsed.data.mission_id)
    .eq('stage_name', 'classifying_categories')
    .eq('started_at', startedAt)

  if (stageFinishError) return { data: null, error: { message: stageFinishError.message } }

  revalidatePath('/workspace')

  return {
    data: {
      mission_id: parsed.data.mission_id,
      total_categories_processed: classified.length,
      auto_accepted_categories: classified.filter(
        ({ result }) => result.classification_status === 'auto_accepted',
      ).length,
      review_required_categories: classified.filter(
        ({ result }) => result.classification_status === 'needs_review',
      ).length,
      normalized_supplier_refs_updated: normalizedSupplierRefsUpdated,
      pending_reviews_count: pendingReviewsCount,
      mission_status: missionStatus,
    },
    error: null,
  }
}

export async function reviewMissionCategoryClassification(
  input: ReviewMissionCategoryClassificationValues,
) {
  const parsed = ReviewMissionCategoryClassificationSchema.safeParse(input)
  if (!parsed.success) return { data: null, error: { message: 'Invalid category review payload.' } }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: { message: 'Unauthorized' } }

  const { data: discoveredCategory, error: categoryError } = await supabase
    .from('discovered_categories')
    .select(
      'id, mission_id, source_url, category_path, raw_label, brand_signal, product_signal, classification_status, classification_confidence',
    )
    .eq('id', parsed.data.category_id)
    .single()

  if (categoryError) return { data: null, error: { message: categoryError.message } }

  const category = discoveredCategory as CategoryRow

  const brandSignal =
    parsed.data.decision === 'edit'
      ? normalizeBrandSignal(parsed.data.brand)
      : parsed.data.decision === 'reject'
        ? null
        : category.brand_signal

  const productSignal =
    parsed.data.decision === 'edit'
      ? normalizeProductSignal(parsed.data.product)
      : parsed.data.decision === 'reject'
        ? null
        : category.product_signal

  if (parsed.data.decision !== 'reject' && !brandSignal && !productSignal) {
    return {
      data: null,
      error: { message: 'Accepted reviews must keep at least one canonical brand or product.' },
    }
  }

  const displayLabel = buildDisplayLabel(brandSignal, productSignal, category.raw_label)

  const { error: updateError } = await supabase
    .from('discovered_categories')
    .update({
      normalized_label: category.raw_label,
      brand_signal: brandSignal,
      product_signal: productSignal,
      classification_status: 'reviewed',
      classification_confidence:
        parsed.data.decision === 'reject'
          ? 0.25
          : Math.max(Number(category.classification_confidence ?? 0), 0.96),
      classification_method: 'manual',
    })
    .eq('id', parsed.data.category_id)

  if (updateError) return { data: null, error: { message: updateError.message } }

  if (parsed.data.decision === 'reject') {
    const { error: deleteError } = await supabase
      .from('mission_category_classifications')
      .delete()
      .eq('source_category_id', parsed.data.category_id)

    if (deleteError) return { data: null, error: { message: deleteError.message } }
  } else {
    const { error: normalizedUpsertError } = await supabase
      .from('mission_category_classifications')
      .upsert(
        {
          mission_id: category.mission_id,
          source_category_id: category.id,
          canonical_brand: brandSignal,
          canonical_product_type: productSignal,
          display_label: displayLabel,
          evidence: {
            raw_label: category.raw_label,
            reviewed_by: user.id,
            decision: parsed.data.decision,
          },
          classification_status: 'reviewed',
          classification_confidence: Math.max(Number(category.classification_confidence ?? 0), 0.96),
          classification_method: 'manual',
        },
        { onConflict: 'mission_id,source_category_id' },
      )

    if (normalizedUpsertError) return { data: null, error: { message: normalizedUpsertError.message } }
  }

  let normalizedSupplierRefsUpdated = 0
  let missionStatus = 'classifying_categories'
  let pendingReviewsCount = 0

  try {
    normalizedSupplierRefsUpdated = await refreshSupplierClassificationRefs(supabase, category.mission_id)
    const statusResult = await updateMissionStatusFromPendingReviews(supabase, category.mission_id)
    missionStatus = statusResult.mission_status
    pendingReviewsCount = statusResult.pending_reviews_count
  } catch (error) {
    return {
      data: null,
      error: { message: error instanceof Error ? error.message : 'Review refresh failed.' },
    }
  }

  revalidatePath('/workspace')

  return {
    data: {
      mission_id: category.mission_id,
      category_id: category.id,
      decision: parsed.data.decision,
      pending_reviews_count: pendingReviewsCount,
      normalized_supplier_refs_updated: normalizedSupplierRefsUpdated,
      mission_status: missionStatus,
    },
    error: null,
  }
}
