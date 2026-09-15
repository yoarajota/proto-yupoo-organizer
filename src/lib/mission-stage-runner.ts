import { z } from 'zod'
import { MissionStageSchema, type MissionStage } from '@/lib/mission-status'
import {
  RunMissionDiscoverySchema,
  IngestMissionYupooImagesSchema,
  type RunMissionDiscoveryValues,
} from '@/lib/schemas/sourcing-discovery'
import {
  RunMissionCategoryClassificationSchema,
  RollupCategoryStrategySchema,
  type RunMissionCategoryClassificationValues,
} from '@/lib/schemas/sourcing-classification'
import {
  RunMissionMatchingSchema,
  type RunMissionMatchingValues,
} from '@/lib/schemas/sourcing-matching'
import {
  GenerateOutreachSuggestionsSchema,
  type GenerateOutreachSuggestionsValues,
} from '@/lib/schemas/sourcing-outreach'
import {
  ParseInboundOffersSchema,
  type ParseInboundOffersValues,
} from '@/lib/schemas/sourcing-inbound'
import { extractDiscoveryFromHtml, scrapeYupooDiscovery } from '@/lib/yupoo/scout'
import {
  ingestMissionYupooImages,
  retryPendingPhotoHashes,
  selectYupooImageUrls,
} from '@/lib/yupoo/yupoo-images'
import { writeAgentRunArtifact } from '@/lib/agent-logs'
import {
  buildCatalogEmbedding,
  CATALOG_EMBEDDING_BRAND_THRESHOLD,
  CATALOG_EMBEDDING_PRODUCT_THRESHOLD,
  stripCatalogSignal,
  type CatalogEmbeddingEntityType,
  type CatalogEmbeddingMatch,
} from '@/lib/catalog-embeddings'
import { classifyDiscoveredCategory, cleanupCategoryText } from '@/lib/yupoo/classification'
import { rollupCategoryStrategy } from '@/lib/mission-category-review'
import type { CanonicalBrand, CanonicalProduct } from '@/lib/yupoo/category-config'
import { refreshSupplierClassificationRefs } from '@/lib/yupoo/supplier-refs'
import type { Database } from '@/types/database'
import { rankSuppliersForMission } from '@/lib/yupoo/match'
import { buildOutreachMessage } from '@/lib/yupoo/outreach'
import { parseInboundMessage } from '@/lib/yupoo/inbound'

/* eslint-disable @typescript-eslint/no-explicit-any */
type SupabaseAdminClient = {
  from: (table: string) => any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rpc?: (...args: any[]) => any
  storage?: {
    from: (bucket: string) => any
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

type ExistingCategoryRow = {
  id: string
  source_url: string
  category_path: string[] | null
}

type ClassificationSourceRow = {
  id: string
  mission_id: string
  source_url: string
  category_path: string[]
  raw_label: string
}

type SupplierMatchRow = {
  supplier_id: string
  rank_score: number
}

type SupplierMessageRow = {
  supplier_id: string
  body: string
  received_or_sent_at: string
}

type MissionStageEventInput = {
  missionId: string
  runId?: string | null
  stage: MissionStage
  eventName: string
  diagnostics?: Record<string, unknown>
}

function getMissionDiscoveryMaxRequests() {
  const configured = Number(process.env.MISSION_DISCOVERY_MAX_REQUESTS ?? '24')
  if (!Number.isFinite(configured)) return 24
  return Math.max(1, Math.min(24, Math.floor(configured)))
}

async function recordMissionStageEvent(
  supabase: SupabaseAdminClient,
  input: MissionStageEventInput,
) {
  const { error } = await supabase
    .from('sourcing_mission_stage_events')
    .insert({
      mission_id: input.missionId,
      run_id: input.runId ?? null,
      stage_name: input.stage,
      event_name: input.eventName,
      diagnostics: input.diagnostics ?? {},
    })

  if (error) {
    console.error('Failed to record mission stage event', error)
  }
}

const MissionWorkerPayloadSchema = z.object({
  stage: MissionStageSchema,
  payload: z.record(z.string(), z.unknown()).refine(
    (payload) => typeof payload.mission_id === 'string' && payload.mission_id.length > 0,
    'payload.mission_id is required',
  ),
})

export type MissionWorkerPayload = z.infer<typeof MissionWorkerPayloadSchema>

export function parseMissionWorkerPayload(input: unknown) {
  return MissionWorkerPayloadSchema.safeParse(input)
}

async function insertStageMetric(
  supabase: SupabaseAdminClient,
  missionId: string,
  stage: MissionStage,
  startedAt: string,
) {
  const { error } = await supabase
    .from('sourcing_mission_stage_metrics')
    .insert({
      mission_id: missionId,
      stage_name: stage,
      started_at: startedAt,
    })

  if (error) throw new Error(error.message)
}

async function finishStageMetric(
  supabase: SupabaseAdminClient,
  missionId: string,
  stage: MissionStage,
  startedAt: string,
  finishedAt: string,
) {
  const { error } = await supabase
    .from('sourcing_mission_stage_metrics')
    .update({ finished_at: finishedAt })
    .eq('mission_id', missionId)
    .eq('stage_name', stage)
    .eq('started_at', startedAt)

  if (error) throw new Error(error.message)
}

async function updateMission(
  supabase: SupabaseAdminClient,
  missionId: string,
  values: Record<string, unknown>,
) {
  const { error } = await supabase
    .from('sourcing_missions')
    .update(values)
    .eq('id', missionId)

  if (error) throw new Error(error.message)
}

async function pruneMissingDiscoveredCategories(
  supabase: SupabaseAdminClient,
  missionId: string,
  categories: Awaited<ReturnType<typeof scrapeYupooDiscovery>>['categories'],
) {
  const { data: existingCategories, error } = await supabase
    .from('discovered_categories')
    .select('id, source_url, category_path')
    .eq('mission_id', missionId)

  if (error) throw new Error(error.message)

  const activeKeys = new Set(
    categories.map((category) => `${category.source_url}::${category.category_path.join('/')}`),
  )
  const staleIds = ((existingCategories ?? []) as ExistingCategoryRow[])
    .filter((category: ExistingCategoryRow) => {
      const categoryKey = `${category.source_url}::${((category.category_path ?? []) as string[]).join('/')}`
      return !activeKeys.has(categoryKey)
    })
    .map((category: ExistingCategoryRow) => category.id)

  if (staleIds.length === 0) return

  const { error: deleteError } = await supabase
    .from('discovered_categories')
    .delete()
    .in('id', staleIds)

  if (deleteError) throw new Error(deleteError.message)
}

export async function executeMissionDiscoveryStage(
  supabase: SupabaseAdminClient,
  input: RunMissionDiscoveryValues,
  context: { runId?: string | null } = {},
) {
  const parsed = RunMissionDiscoverySchema.parse(input)
  const startedAt = new Date().toISOString()
  const discoveryMaxRequests = getMissionDiscoveryMaxRequests()

  await updateMission(supabase, parsed.mission_id, { status: 'scanning' })
  await insertStageMetric(supabase, parsed.mission_id, 'discovery', startedAt)
  await recordMissionStageEvent(supabase, {
    missionId: parsed.mission_id,
    runId: context.runId,
    stage: 'discovery',
    eventName: 'worker_discovery_started',
    diagnostics: {
      has_html_snapshot: Boolean(parsed.html_snapshot),
      configured_max_requests: discoveryMaxRequests,
    },
  })

  const { data: mission, error: missionError } = await supabase
    .from('sourcing_missions')
    .select('id, seed_url')
    .eq('id', parsed.mission_id)
    .single()

  if (missionError) throw new Error(missionError.message)

  const seedUrl = parsed.seed_url ?? mission.seed_url
  await recordMissionStageEvent(supabase, {
    missionId: parsed.mission_id,
    runId: context.runId,
    stage: 'discovery',
    eventName: 'worker_discovery_fetch_started',
    diagnostics: { seed_url: seedUrl, using_html_snapshot: Boolean(parsed.html_snapshot) },
  })

  const discovered = parsed.html_snapshot
    ? {
        ...extractDiscoveryFromHtml(parsed.html_snapshot, seedUrl, startedAt),
        pages: [],
      }
    : await scrapeYupooDiscovery(seedUrl, discoveryMaxRequests)

  await recordMissionStageEvent(supabase, {
    missionId: parsed.mission_id,
    runId: context.runId,
    stage: 'discovery',
    eventName: 'worker_discovery_extracted',
    diagnostics: {
      categories_count: discovered.categories.length,
      suppliers_count: discovered.suppliers.length,
      categories_with_preview_images_count: discovered.categories.filter(
        (category) => category.preview_image_urls.length > 0,
      ).length,
      categories_with_fetched_preview_status_count: discovered.categories.filter(
        (category) => category.preview_image_status === 'fetched',
      ).length,
      pages_count: discovered.pages.length,
      failed_pages_count: discovered.pages.filter((page) => page.status === 'failed').length,
    },
  })

  if (
    !parsed.html_snapshot &&
    discovered.categories.length === 0 &&
    discovered.pages.length > 0 &&
    discovered.pages.every((page) => page.status === 'failed')
  ) {
    throw new Error(discovered.pages[0]?.error ?? 'Every Yupoo discovery request failed.')
  }

  await pruneMissingDiscoveredCategories(supabase, parsed.mission_id, discovered.categories)
  await recordMissionStageEvent(supabase, {
    missionId: parsed.mission_id,
    runId: context.runId,
    stage: 'discovery',
    eventName: 'worker_discovery_pruned',
    diagnostics: { active_categories_count: discovered.categories.length },
  })

  if (discovered.categories.length > 0) {
    const { error } = await supabase
      .from('discovered_categories')
      .upsert(
        discovered.categories.map((category) => ({
          mission_id: parsed.mission_id,
          source_url: category.source_url,
          category_path: category.category_path,
          raw_label: category.raw_label,
          preview_image_urls: category.preview_image_urls,
          extracted_at: category.extracted_at,
          confidence: category.confidence,
        })),
        { onConflict: 'mission_id,source_url,category_path' },
      )

    if (error) throw new Error(error.message)
  }
  await recordMissionStageEvent(supabase, {
    missionId: parsed.mission_id,
    runId: context.runId,
    stage: 'discovery',
    eventName: 'worker_discovery_categories_saved',
    diagnostics: { categories_count: discovered.categories.length },
  })

  if (discovered.suppliers.length > 0) {
    const { error } = await supabase
      .from('discovered_suppliers')
      .upsert(
        discovered.suppliers.map((supplier) => ({
          mission_id: parsed.mission_id,
          supplier_key: supplier.supplier_key,
          source_url: supplier.source_url,
          category_refs: supplier.category_refs,
          normalized_category_refs: supplier.normalized_category_refs,
          last_seen_at: supplier.last_seen_at,
          confidence: supplier.confidence,
        })),
        { onConflict: 'mission_id,supplier_key,source_url' },
      )

    if (error) throw new Error(error.message)
  }
  await recordMissionStageEvent(supabase, {
    missionId: parsed.mission_id,
    runId: context.runId,
    stage: 'discovery',
    eventName: 'worker_discovery_suppliers_saved',
    diagnostics: { suppliers_count: discovered.suppliers.length },
  })

  const { urls: yupooImageUrls, capped: yupooImagesCapped } = selectYupooImageUrls(
    discovered.categories,
  )
  const ingestInput = IngestMissionYupooImagesSchema.safeParse({
    mission_id: parsed.mission_id,
    image_urls: yupooImageUrls,
  })
  let yupooImageIngest: Record<string, unknown> = {
    skipped: yupooImageUrls.length === 0 || !ingestInput.success,
  }
  try {
    if (ingestInput.success && ingestInput.data.image_urls.length > 0) {
      const ingested = await ingestMissionYupooImages(
        supabase,
        parsed.mission_id,
        ingestInput.data.image_urls,
      )
      const retried = await retryPendingPhotoHashes(supabase, {
        missionId: parsed.mission_id,
      })
      yupooImageIngest = { ...ingested, ...retried, capped: yupooImagesCapped }
    }
  } catch (error) {
    yupooImageIngest = {
      failed: true,
      message: error instanceof Error ? error.message : 'Yupoo image ingest failed.',
    }
  }
  await recordMissionStageEvent(supabase, {
    missionId: parsed.mission_id,
    runId: context.runId,
    stage: 'discovery',
    eventName: 'worker_discovery_images_ingested',
    diagnostics: yupooImageIngest,
  })

  const finishedAt = new Date().toISOString()
  await finishStageMetric(supabase, parsed.mission_id, 'discovery', startedAt, finishedAt)
  await updateMission(supabase, parsed.mission_id, { status: 'completed' })
  await recordMissionStageEvent(supabase, {
    missionId: parsed.mission_id,
    runId: context.runId,
    stage: 'discovery',
    eventName: 'worker_discovery_finished',
    diagnostics: {
      next_status: 'completed',
      finished_at: finishedAt,
      categories_count: discovered.categories.length,
      suppliers_count: discovered.suppliers.length,
      categories_with_preview_images_count: discovered.categories.filter(
        (category) => category.preview_image_urls.length > 0,
      ).length,
    },
  })

  return {
    mission_id: parsed.mission_id,
    categories_count: discovered.categories.length,
    suppliers_count: discovered.suppliers.length,
  }
}

function getOrigin(url: string) {
  try {
    return new URL(url).origin
  } catch {
    return url
  }
}

type BrandAliasRow = {
  slug: string
  name: string
  brand_aliases?: { alias: string }[] | null
}

type ProductTypeRow = {
  slug: string
  name: string
}

type CatalogEmbeddingRpcMatch =
  Database['public']['Functions']['match_catalog_embeddings']['Returns'][number]

type ClassifiedRow = {
  source: ClassificationSourceRow
  result: ReturnType<typeof classifyDiscoveredCategory>
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

function toCatalogEmbeddingMatch(
  row: CatalogEmbeddingRpcMatch | null | undefined,
  threshold: number,
): CatalogEmbeddingMatch | null {
  if (!row?.canonical_slug || !row.entity_id || !row.entity_type || !row.source_text) return null

  return {
    entity_type: row.entity_type as CatalogEmbeddingEntityType,
    entity_id: row.entity_id,
    canonical_slug: row.canonical_slug,
    canonical_name: row.canonical_name ?? row.canonical_slug,
    source_text: row.source_text,
    similarity: Number(row.similarity ?? 0),
    threshold,
  }
}

async function fetchCatalogEmbeddingMatch(
  supabase: SupabaseAdminClient,
  input: {
    text: string
    entityTypes: CatalogEmbeddingEntityType[]
    threshold: number
  },
) {
  if (!supabase.rpc) return null
  const embedding = buildCatalogEmbedding(input.text)
  const { data, error } = await supabase.rpc('match_catalog_embeddings', {
    query_embedding: embedding.pgvector,
    entity_types: input.entityTypes,
    match_threshold: input.threshold,
    match_count: 1,
  })

  if (error) throw new Error(error.message)

  return toCatalogEmbeddingMatch((data as CatalogEmbeddingRpcMatch[] | null)?.[0], input.threshold)
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

export async function executeMissionCategoryClassificationStage(
  supabase: SupabaseAdminClient,
  input: RunMissionCategoryClassificationValues,
) {
  const parsed = RunMissionCategoryClassificationSchema.parse(input)
  const startedAt = new Date().toISOString()

  await updateMission(supabase, parsed.mission_id, { status: 'classifying_categories' })
  await insertStageMetric(supabase, parsed.mission_id, 'classifying_categories', startedAt)

  const { data: categories, error } = await supabase
    .from('discovered_categories')
    .select('id, mission_id, source_url, category_path, raw_label')
    .eq('mission_id', parsed.mission_id)

  if (error) throw new Error(error.message)

  const { data: brandRows, error: brandRowsError } = await supabase
    .from('brands')
    .select('slug, name, brand_aliases(alias)')
    .order('name')

  if (brandRowsError) throw new Error(brandRowsError.message)

  const { data: productTypeRows, error: productTypeRowsError } = await supabase
    .from('product_types')
    .select('slug, name')
    .order('name')

  if (productTypeRowsError) throw new Error(productTypeRowsError.message)

  const canonicalBrands = (brandRows ?? []).length > 0
    ? toCanonicalBrands((brandRows ?? []) as BrandAliasRow[])
    : undefined
  const canonicalProducts = (productTypeRows ?? []).length > 0
    ? toCanonicalProducts((productTypeRows ?? []) as ProductTypeRow[])
    : undefined

  const categoryRows = (categories ?? []) as ClassificationSourceRow[]

  const normalizedLabelCounts = new Map<string, number>()
  const normalizedLabelCountsByShop = new Map<string, number>()
  const repeatedSignalPairCounts = new Map<string, number>()

  const ruleOnlyClassified = categoryRows.map((category) => ({
    source: category,
    ruleResult: classifyDiscoveredCategory({
      ...category,
      context: {
        canonical_brands: canonicalBrands,
        canonical_products: canonicalProducts,
      },
    }),
  }))

  const vectorResolved = await Promise.all(ruleOnlyClassified.map(async ({ source, ruleResult }) => {
    const needsBrandMatch = !ruleResult.brand_signal
    const needsProductMatch = !ruleResult.product_signal

    let embeddingBrandMatch: CatalogEmbeddingMatch | null = null
    let embeddingProductMatch: CatalogEmbeddingMatch | null = null

    if (needsBrandMatch || needsProductMatch) {
      ;[embeddingBrandMatch, embeddingProductMatch] = await Promise.all([
        needsBrandMatch
          ? fetchCatalogEmbeddingMatch(supabase, {
              text: stripCatalogSignal(ruleResult.normalized_label, ruleResult.product_signal),
              entityTypes: ['brand', 'brand_alias'],
              threshold: CATALOG_EMBEDDING_BRAND_THRESHOLD,
            })
          : Promise.resolve(null),
        needsProductMatch
          ? fetchCatalogEmbeddingMatch(supabase, {
              text: stripCatalogSignal(ruleResult.normalized_label, ruleResult.brand_signal),
              entityTypes: ['product_type'],
              threshold: CATALOG_EMBEDDING_PRODUCT_THRESHOLD,
            })
          : Promise.resolve(null),
      ])
    }

    const result = classifyDiscoveredCategory({
      ...source,
      context: {
        canonical_brands: canonicalBrands,
        canonical_products: canonicalProducts,
        embedding_brand_match: embeddingBrandMatch,
        embedding_product_match: embeddingProductMatch,
      },
    })

    normalizedLabelCounts.set(
      result.normalized_label,
      (normalizedLabelCounts.get(result.normalized_label) ?? 0) + 1,
    )

    const shopLabelKey = `${getOrigin(source.source_url)}::${result.normalized_label}`
    normalizedLabelCountsByShop.set(
      shopLabelKey,
      (normalizedLabelCountsByShop.get(shopLabelKey) ?? 0) + 1,
    )

    if (result.brand_signal && result.product_signal) {
      const signalPairKey = `${result.brand_signal}::${result.product_signal}`
      repeatedSignalPairCounts.set(
        signalPairKey,
        (repeatedSignalPairCounts.get(signalPairKey) ?? 0) + 1,
      )
    }

    return {
      source,
      embeddingBrandMatch,
      embeddingProductMatch,
      baseResult: result,
    }
  }))

  const classified = vectorResolved.map(({
    source,
    embeddingBrandMatch,
    embeddingProductMatch,
    baseResult,
  }) => ({
    source,
    result: classifyDiscoveredCategory({
      ...source,
      context: {
        canonical_brands: canonicalBrands,
        canonical_products: canonicalProducts,
        embedding_brand_match: embeddingBrandMatch,
        embedding_product_match: embeddingProductMatch,
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

  let normalizedSupplierRefsUpdated = 0

  if (classified.length > 0) {
    const { error: categoryError } = await supabase
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

    if (categoryError) throw new Error(categoryError.message)

    const { error: classificationError } = await supabase
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

    if (classificationError) throw new Error(classificationError.message)

    normalizedSupplierRefsUpdated = await refreshSupplierClassificationRefs(
      supabase,
      parsed.mission_id,
    )
  }

  const strategyInput = RollupCategoryStrategySchema.safeParse({ mission_id: parsed.mission_id })
  const categoryStrategy = strategyInput.success
    ? rollupCategoryStrategy(
        classified.map(({ source, result }) => ({
          mission_id: source.mission_id,
          source_category_id: source.id,
          source_url: source.source_url,
          raw_label: source.raw_label,
          normalized_label: result.normalized_label,
          canonical_brand: result.brand_signal,
          canonical_product_type: result.product_signal,
          display_label: result.display_label,
          classification_status: result.classification_status,
          classification_confidence: result.classification_confidence,
        })),
      )
    : []
  await recordMissionStageEvent(supabase, {
    missionId: parsed.mission_id,
    stage: 'classifying_categories',
    eventName: 'worker_classification_strategy_rolled_up',
    diagnostics: {
      group_count: categoryStrategy.length,
      multi_shop_group_count: categoryStrategy.filter((group) => group.shop_origins.length > 1).length,
      multi_mission_group_count: categoryStrategy.filter((group) => group.mission_ids.length > 1).length,
      top_group_key: categoryStrategy[0]?.group_key ?? null,
      groups: categoryStrategy.slice(0, 25),
    },
  })

  try {
    await writeAgentRunArtifact('classification', parsed.mission_id, startedAt, {
      finished_at: new Date().toISOString(),
      mission_status: 'completed',
      pending_reviews_count: classified.filter(
        ({ result }) => result.classification_status === 'needs_review',
      ).length,
      normalized_supplier_refs_updated: normalizedSupplierRefsUpdated,
      category_strategy: {
        group_count: categoryStrategy.length,
        groups: categoryStrategy,
      },
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

  const reviewRequired = classified.filter(
    ({ result }) => result.classification_status === 'needs_review',
  ).length
  const missionStatus = 'completed'
  const finishedAt = new Date().toISOString()

  await finishStageMetric(supabase, parsed.mission_id, 'classifying_categories', startedAt, finishedAt)
  await updateMission(supabase, parsed.mission_id, { status: missionStatus })

  return {
    mission_id: parsed.mission_id,
    total_categories_processed: classified.length,
    auto_accepted_categories: classified.length - reviewRequired,
    review_required_categories: reviewRequired,
    normalized_supplier_refs_updated: normalizedSupplierRefsUpdated,
    pending_reviews_count: reviewRequired,
    mission_status: missionStatus,
  }
}

export async function executeMissionMatchingStage(
  supabase: SupabaseAdminClient,
  input: RunMissionMatchingValues,
) {
  const parsed = RunMissionMatchingSchema.parse(input)
  const startedAt = new Date().toISOString()

  await updateMission(supabase, parsed.mission_id, { status: 'matching' })
  await insertStageMetric(supabase, parsed.mission_id, 'matching', startedAt)

  const { data: mission, error: missionError } = await supabase
    .from('sourcing_missions')
    .select('id, product_intent')
    .eq('id', parsed.mission_id)
    .single()

  if (missionError) throw new Error(missionError.message)

  const { data: discoveredSuppliers, error: suppliersError } = await supabase
    .from('discovered_suppliers')
    .select('id, supplier_key, category_refs, normalized_category_refs, last_seen_at, confidence')
    .eq('mission_id', parsed.mission_id)

  if (suppliersError) throw new Error(suppliersError.message)

  const ranked = rankSuppliersForMission(
    mission.product_intent,
    discoveredSuppliers ?? [],
    startedAt,
  ).slice(0, parsed.shortlist_limit)

  if (ranked.length > 0) {
    const { error } = await supabase
      .from('mission_supplier_matches')
      .upsert(
        ranked.map((entry) => ({
          mission_id: parsed.mission_id,
          supplier_id: entry.supplier_id,
          rank_score: entry.rank_score,
          rank_reasons: entry.rank_reasons,
        })),
        { onConflict: 'mission_id,supplier_id' },
      )

    if (error) throw new Error(error.message)
  }

  const finishedAt = new Date().toISOString()
  await finishStageMetric(supabase, parsed.mission_id, 'matching', startedAt, finishedAt)
  await updateMission(supabase, parsed.mission_id, { status: 'suggestions_ready' })

  return {
    mission_id: parsed.mission_id,
    shortlisted_suppliers_count: ranked.length,
    top_rank_score: ranked[0]?.rank_score ?? null,
  }
}

export async function executeOutreachSuggestionsStage(
  supabase: SupabaseAdminClient,
  input: GenerateOutreachSuggestionsValues,
) {
  const parsed = GenerateOutreachSuggestionsSchema.parse(input)
  const startedAt = new Date().toISOString()

  await insertStageMetric(supabase, parsed.mission_id, 'suggestion_generation', startedAt)

  const { data: mission, error: missionError } = await supabase
    .from('sourcing_missions')
    .select('id, product_intent, destination_context, constraints')
    .eq('id', parsed.mission_id)
    .single()

  if (missionError) throw new Error(missionError.message)

  const { data: matches, error: matchesError } = await supabase
    .from('mission_supplier_matches')
    .select('supplier_id, rank_score')
    .eq('mission_id', parsed.mission_id)
    .order('rank_score', { ascending: false })

  if (matchesError) throw new Error(matchesError.message)

  const shortlist = ((matches ?? []) as SupplierMatchRow[]).slice(0, parsed.max_suggestions)
  const supplierIds = shortlist.map((item) => item.supplier_id)

  let suppliers: Array<{ id: string; supplier_key: string }> = []
  if (supplierIds.length > 0) {
    const { data, error } = await supabase
      .from('discovered_suppliers')
      .select('id, supplier_key')
      .in('id', supplierIds)

    if (error) throw new Error(error.message)
    suppliers = data ?? []
  }

  const supplierLookup = new Map(suppliers.map((supplier) => [supplier.id, supplier]))
  const suggestions = shortlist
    .map((match) => {
      const supplier = supplierLookup.get(match.supplier_id)
      if (!supplier) return null

      return {
        mission_id: parsed.mission_id,
        supplier_id: supplier.id,
        channel_hint: 'whatsapp',
        language: 'en',
        message_text: buildOutreachMessage({
          productIntent: mission.product_intent,
          destinationContext: mission.destination_context,
          constraints: mission.constraints as Record<string, unknown> | null,
          supplierKey: supplier.supplier_key,
        }),
        status: 'pending_approval' as const,
      }
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)

  if (suggestions.length > 0) {
    const { error } = await supabase
      .from('outreach_suggestions')
      .upsert(suggestions, { onConflict: 'mission_id,supplier_id' })

    if (error) throw new Error(error.message)
  }

  const finishedAt = new Date().toISOString()
  await finishStageMetric(supabase, parsed.mission_id, 'suggestion_generation', startedAt, finishedAt)
  await updateMission(supabase, parsed.mission_id, {
    status: 'awaiting_approval',
    first_suggestion_batch_at: finishedAt,
  })

  return {
    mission_id: parsed.mission_id,
    suggestions_count: suggestions.length,
  }
}

export async function executeInboundOfferParsingStage(
  supabase: SupabaseAdminClient,
  input: ParseInboundOffersValues,
) {
  const parsed = ParseInboundOffersSchema.parse(input)
  const startedAt = new Date().toISOString()

  await updateMission(supabase, parsed.mission_id, { status: 'replies_received' })
  await insertStageMetric(supabase, parsed.mission_id, 'parse', startedAt)

  const { data: messages, error } = await supabase
    .from('supplier_messages')
    .select('id, supplier_id, body, received_or_sent_at')
    .eq('mission_id', parsed.mission_id)
    .eq('direction', 'inbound')
    .order('received_or_sent_at', { ascending: false })
    .limit(parsed.max_messages)

  if (error) throw new Error(error.message)

  const parsedMessages = ((messages ?? []) as SupplierMessageRow[]).map((message) => ({
    supplier_id: message.supplier_id,
    parsed: parseInboundMessage(message.body),
    received_or_sent_at: message.received_or_sent_at,
  }))

  const offers = parsedMessages
    .filter((entry) => entry.parsed.unitPrice !== null || entry.parsed.moq !== null || entry.parsed.leadTime !== null)
    .map((entry) => ({
      mission_id: parsed.mission_id,
      supplier_id: entry.supplier_id,
      unit_price: entry.parsed.unitPrice,
      currency: entry.parsed.currency,
      moq: entry.parsed.moq,
      lead_time: entry.parsed.leadTime,
      terms_notes: entry.parsed.termsNotes,
      extraction_confidence: entry.parsed.extractionConfidence,
      extracted_at: entry.received_or_sent_at,
    }))

  if (offers.length > 0) {
    const { error: offersError } = await supabase
      .from('normalized_offers')
      .upsert(offers, { onConflict: 'mission_id,supplier_id' })

    if (offersError) throw new Error(offersError.message)
  }

  const catalogueSummaries = parsedMessages
    .filter((entry) => entry.parsed.catalogueSummary !== null)
    .map((entry) => ({
      mission_id: parsed.mission_id,
      supplier_id: entry.supplier_id,
      catalogue_received_at: entry.received_or_sent_at,
      summary_text: entry.parsed.catalogueSummary as string,
      summary_confidence: entry.parsed.extractionConfidence,
    }))

  if (catalogueSummaries.length > 0) {
    const { error: catalogueError } = await supabase
      .from('catalogue_summaries')
      .upsert(catalogueSummaries, { onConflict: 'mission_id,supplier_id' })

    if (catalogueError) throw new Error(catalogueError.message)
  }

  const finishedAt = new Date().toISOString()
  await finishStageMetric(supabase, parsed.mission_id, 'parse', startedAt, finishedAt)

  const hasValidQuote = offers.some((offer) => offer.unit_price !== null)
  await updateMission(
    supabase,
    parsed.mission_id,
    hasValidQuote
      ? { status: 'offers_normalized', first_valid_quote_at: finishedAt }
      : { status: 'offers_normalized' },
  )

  return {
    mission_id: parsed.mission_id,
    offers_count: offers.length,
    catalogue_summaries_count: catalogueSummaries.length,
  }
}

export async function executeMissionStage(
  supabase: SupabaseAdminClient,
  stage: MissionStage,
  payload: Record<string, unknown>,
) {
  const missionId = typeof payload.mission_id === 'string' ? payload.mission_id : null
  const runId = typeof payload.run_id === 'string' ? payload.run_id : null

  if (missionId) {
    await recordMissionStageEvent(supabase, {
      missionId,
      runId,
      stage,
      eventName: 'worker_received',
      diagnostics: {
        payload_keys: Object.keys(payload).sort(),
      },
    })
  }

  try {
    if (missionId) {
      await recordMissionStageEvent(supabase, {
        missionId,
        runId,
        stage,
        eventName: 'worker_started',
        diagnostics: {},
      })
    }

    const result =
      stage === 'discovery'
        ? await executeMissionDiscoveryStage(
            supabase,
            RunMissionDiscoverySchema.parse(payload),
            { runId },
          )
        : stage === 'classifying_categories'
          ? await executeMissionCategoryClassificationStage(
              supabase,
              RunMissionCategoryClassificationSchema.parse(payload),
            )
          : stage === 'matching'
            ? await executeMissionMatchingStage(
                supabase,
                RunMissionMatchingSchema.parse(payload),
              )
            : stage === 'suggestion_generation'
              ? await executeOutreachSuggestionsStage(
                  supabase,
                  GenerateOutreachSuggestionsSchema.parse(payload),
                )
              : await executeInboundOfferParsingStage(
                  supabase,
                  ParseInboundOffersSchema.parse(payload),
                )

    if (missionId) {
      await recordMissionStageEvent(supabase, {
        missionId,
        runId,
        stage,
        eventName: 'worker_succeeded',
        diagnostics: result,
      })
    }

    return result
  } catch (error) {
    if (missionId) {
      await recordMissionStageEvent(supabase, {
        missionId,
        runId,
        stage,
        eventName: 'worker_failed',
        diagnostics: {
          message: error instanceof Error ? error.message : 'Mission worker failed.',
        },
      })
    }

    throw error
  }
}
