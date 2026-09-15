'use server'

import { revalidatePath } from 'next/cache'
import { executeMissionCategoryClassificationStage } from '@/lib/mission-stage-runner'
import { enqueueMissionStage } from '@/lib/mission-queue'
import { createClient } from '@/lib/supabase/server'
import {
  ReviewMissionCategoryClassificationSchema,
  RunMissionCategoryClassificationSchema,
  type ReviewMissionCategoryClassificationValues,
  type RunMissionCategoryClassificationValues,
} from '@/lib/schemas/sourcing-classification'
import { normalizeBrandSignal, normalizeProductSignal } from '@/lib/yupoo/classification'
import {
  attachSuggestedReviewAliases,
  buildKnownAliasForms,
  groupMissionCategoryReviewItems,
  toPendingCategoryReviewRows,
  toReviewDecisions,
} from '@/lib/mission-category-review'
import { z } from 'zod'
import { refreshSupplierClassificationRefs } from '@/lib/yupoo/supplier-refs'
import type { CanonicalBrand, CanonicalProduct } from '@/lib/yupoo/category-config'

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

type BrandAliasRow = {
  id: string
  slug: string
  name: string
  brand_aliases?: { alias: string }[] | null
}

type ProductTypeRow = {
  slug: string
  name: string
}

function buildDisplayLabel(brand: string | null, product: string | null, fallback: string) {
  const brandDisplay = brand ? brand.toUpperCase() : null
  const productDisplay = product
    ? product.charAt(0).toUpperCase() + product.slice(1)
    : null
  return [brandDisplay, productDisplay].filter(Boolean).join(' ') || fallback
}

function toCanonicalBrands(rows: BrandAliasRow[]): CanonicalBrand[] {
  return rows.map((brand) => ({
    canonical: brand.slug,
    display: brand.name,
    aliases: Array.from(
      new Set([
        brand.name,
        brand.slug,
        ...(brand.brand_aliases ?? []).map((alias) => alias.alias),
      ]),
    ),
    embeddingTerms: Array.from(
      new Set([
        brand.name,
        brand.slug,
        ...(brand.brand_aliases ?? []).map((alias) => alias.alias),
      ]),
    ),
  }))
}

function toCanonicalProducts(rows: ProductTypeRow[]): CanonicalProduct[] {
  return rows.map((productType) => ({
    canonical: productType.slug,
    display: productType.name,
    aliases: Array.from(new Set([productType.name, productType.slug])),
  }))
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

  const status = 'completed'

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

  const result = await enqueueMissionStage(supabase, {
    mission_id: parsed.data.mission_id,
    stage: 'classifying_categories',
    payload: { requested_by: user.id },
  })

  revalidatePath('/workspace')
  return result
}

export async function executeMissionCategoryClassificationDirect(input: RunMissionCategoryClassificationValues) {  const parsed = RunMissionCategoryClassificationSchema.safeParse(input)
  if (!parsed.success) return { data: null, error: { message: 'Invalid classification payload.' } }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: { message: 'Unauthorized' } }

  try {
    const data = await executeMissionCategoryClassificationStage(supabase, parsed.data)
    revalidatePath('/workspace')
    return { data, error: null }
  } catch (error) {
    return {
      data: null,
      error: { message: error instanceof Error ? error.message : 'Classification refresh failed.' },
    }
  }
}

function isMissionRunInline() {
  const raw = process.env.MISSION_RUN_INLINE?.trim().toLowerCase()
  if (raw === 'true') return true
  if (raw === 'false') return false
  return process.env.NODE_ENV === 'development'
}

function isMissionWorkerConfigured() {
  return Boolean(process.env.MISSION_WORKER_URL && process.env.MISSION_WORKER_TOKEN)
}

export async function runMissionCategoryClassificationWithFallback(input: RunMissionCategoryClassificationValues) {
  // The queue processor reports per-message stage failures as HTTP 200, so a
  // locally-broken worker is indistinguishable from success at enqueue time.
  // Inline mode therefore bypasses the queue entirely instead of probing it.
  if (isMissionRunInline()) {
    return executeMissionCategoryClassificationDirect(input)
  }
  if (isMissionWorkerConfigured()) {
    const queued = await runMissionCategoryClassification(input)
    if (queued.error && queued.data?.processor_invoked === false) {
      return executeMissionCategoryClassificationDirect(input)
    }
    return queued
  }
  return executeMissionCategoryClassificationDirect(input)
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

  const [{ data: brandRows, error: brandRowsError }, { data: productTypeRows, error: productTypeRowsError }] =
    await Promise.all([
      supabase
        .from('brands')
        .select('id, slug, name, brand_aliases(alias)')
        .order('name'),
      supabase
        .from('product_types')
        .select('slug, name')
        .order('name'),
    ])

  if (brandRowsError) return { data: null, error: { message: brandRowsError.message } }
  if (productTypeRowsError) return { data: null, error: { message: productTypeRowsError.message } }

  const canonicalBrands = (brandRows ?? []).length > 0
    ? toCanonicalBrands((brandRows ?? []) as BrandAliasRow[])
    : undefined
  const canonicalProducts = (productTypeRows ?? []).length > 0
    ? toCanonicalProducts((productTypeRows ?? []) as ProductTypeRow[])
    : undefined

  const brandSignal =
    parsed.data.decision === 'edit'
      ? normalizeBrandSignal(parsed.data.brand, canonicalBrands)
      : parsed.data.decision === 'reject'
        ? null
        : category.brand_signal

  const productSignal =
    parsed.data.decision === 'edit'
      ? normalizeProductSignal(parsed.data.product, canonicalProducts)
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

    if (brandSignal) {
      const brandRow = ((brandRows ?? []) as BrandAliasRow[]).find((row) => row.slug === brandSignal)
      const variant = category.raw_label.trim()
      const alreadyCurated = !brandRow || !variant
        ? true
        : [brandRow.name, brandRow.slug, ...(brandRow.brand_aliases ?? []).map((alias) => alias.alias)]
          .some((known) => known.toLowerCase() === variant.toLowerCase())

      if (brandRow && variant && !alreadyCurated) {
        // Alias learning is best-effort: the review already succeeded, so a
        // conflicting or rejected alias write must not fail it.
        await supabase.from('brand_aliases').insert({
          brand_id: brandRow.id,
          alias: variant,
          created_by: user.id,
        })
      }
    }
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

export async function getMissionReviewQueue(input: { mission_id: string }) {
  const parsed = z.object({ mission_id: z.string().uuid() }).safeParse(input)
  if (!parsed.success) return { data: null, error: { message: 'Invalid review queue payload.' } }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: { message: 'Unauthorized' } }

  const { data: pendingRows, error: pendingError } = await supabase
    .from('discovered_categories')
    .select(
      'id, mission_id, raw_label, normalized_label, brand_signal, product_signal, classification_confidence, classification_method, classification_status, preview_image_urls, source_url',
    )
    .eq('mission_id', parsed.data.mission_id)
    .eq('classification_status', 'needs_review')

  if (pendingError) return { data: null, error: { message: pendingError.message } }

  const { data: reviewedRows, error: reviewedError } = await supabase
    .from('mission_category_classifications')
    .select('canonical_brand, evidence')
    .eq('mission_id', parsed.data.mission_id)
    .eq('classification_status', 'reviewed')

  if (reviewedError) return { data: null, error: { message: reviewedError.message } }

  const { data: brandRows, error: brandRowsError } = await supabase
    .from('brands')
    .select('name, slug, brand_aliases(alias)')

  if (brandRowsError) return { data: null, error: { message: brandRowsError.message } }

  const knownAliasForms = buildKnownAliasForms((brandRows ?? []) as BrandAliasRow[])

  const decisions = toReviewDecisions(
    ((reviewedRows ?? []) as Array<{ canonical_brand: string | null; evidence: unknown }>),
  )

  const reviewRows = toPendingCategoryReviewRows(
    (pendingRows ?? []) as Array<{
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
    }>,
  )

  const grouped = groupMissionCategoryReviewItems(reviewRows)[parsed.data.mission_id] ?? []
  const groups = attachSuggestedReviewAliases(grouped, decisions, knownAliasForms)

  return {
    data: {
      mission_id: parsed.data.mission_id,
      groups,
      decisions_considered: decisions.length,
    },
    error: null,
  }
}
