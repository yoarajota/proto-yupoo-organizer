import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { YupooDiscoveryResult } from './scout.ts'

export type YupooShopEvalExpectation = {
  min_categories?: number
  expected_labels?: string[]
  min_preview_image_categories?: number
  require_preview_images?: boolean
}

export type YupooShopEvalCase = {
  id?: string
  url: string
  max_requests?: number
  expectations?: YupooShopEvalExpectation
  notes?: string
}

export type YupooShopEvalInput = {
  max_requests?: number
  shops: YupooShopEvalCase[]
}

export type YupooShopRunSummary = {
  id: string
  url: string
  artifact_path: string
  ok: boolean
  duration_ms: number
  page_count: number
  fetched_page_count: number
  failed_page_count: number
  category_count: number
  supplier_count: number
  preview_fetched_category_count: number
  preview_image_count: number
  labels: string[]
  content_hashes: string[]
  page_failures: Array<{ url: string; error: string | null; http_status: number | null }>
  missing_preview_categories: Array<{ source_url: string; raw_label: string }>
  failure_codes: string[]
  expectations: YupooShopEvalExpectation
  error: string | null
}

export type YupooScrapeEvalReport = {
  run_dir: string
  generated_at: string
  total_shops: number
  passed_shops: number
  failed_shops: number
  common_failure_clusters: Array<{ code: string; count: number; shop_ids: string[] }>
  zero_category_shops: string[]
  missing_preview_image_cases: Array<{ shop_id: string; source_url: string; raw_label: string }>
  blocked_or_failed_pages: Array<{ shop_id: string; url: string; error: string | null; http_status: number | null }>
  candidate_fixtures: Array<{ shop_id: string; url: string; content_hash: string }>
  shops: YupooShopRunSummary[]
}

export type YupooScrapeEvalComparison = {
  previous_run_dir: string
  current_run_dir: string
  generated_at: string
  passed_shop_delta: number
  failed_shop_delta: number
  improved_failure_clusters: Array<{ code: string; previous_count: number; current_count: number; delta: number }>
  worsened_failure_clusters: Array<{ code: string; previous_count: number; current_count: number; delta: number }>
  shop_deltas: Array<{
    id: string
    previous_ok: boolean | null
    current_ok: boolean | null
    category_count_delta: number | null
    preview_image_count_delta: number | null
    preview_fetched_category_count_delta: number | null
    regressed: boolean
    improved: boolean
    notes: string[]
  }>
  previously_passing_regressions: Array<{
    id: string
    category_count_delta: number | null
    preview_image_count_delta: number | null
    preview_fetched_category_count_delta: number | null
    notes: string[]
  }>
  acceptance: {
    unit_tests_passed: boolean
    no_previously_passing_regressions: boolean
    at_least_one_failure_cluster_improved: boolean
    accepted: boolean
  }
}

function assertObject(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (typeof value !== 'object' || value == null || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`)
  }
}

function assertNonNegativeInteger(value: unknown, label: string) {
  if (value == null) return undefined
  if (!Number.isInteger(value) || Number(value) < 0) {
    throw new Error(`${label} must be a non-negative integer.`)
  }
  return Number(value)
}

function normalizeShopId(url: string, id?: string) {
  if (id?.trim()) return id.trim().replace(/[^a-zA-Z0-9_.-]+/g, '-')
  const parsed = new URL(url)
  return parsed.hostname.replace(/[^a-zA-Z0-9_.-]+/g, '-')
}

function normalizeExpectations(value: unknown): YupooShopEvalExpectation {
  if (value == null) return {}
  assertObject(value, 'shop.expectations')

  const expectedLabels = value.expected_labels
  if (expectedLabels != null && (!Array.isArray(expectedLabels) || expectedLabels.some((label) => typeof label !== 'string'))) {
    throw new Error('shop.expectations.expected_labels must be an array of strings.')
  }

  const requirePreviewImages = value.require_preview_images
  if (requirePreviewImages != null && typeof requirePreviewImages !== 'boolean') {
    throw new Error('shop.expectations.require_preview_images must be a boolean.')
  }

  return {
    min_categories: assertNonNegativeInteger(value.min_categories, 'shop.expectations.min_categories'),
    expected_labels: expectedLabels?.map((label) => label.trim()).filter(Boolean) as string[] | undefined,
    min_preview_image_categories: assertNonNegativeInteger(
      value.min_preview_image_categories,
      'shop.expectations.min_preview_image_categories',
    ),
    require_preview_images: typeof requirePreviewImages === 'boolean' ? requirePreviewImages : undefined,
  }
}

export function parseYupooShopEvalInput(value: unknown): YupooShopEvalInput {
  assertObject(value, 'eval input')
  if (!Array.isArray(value.shops) || value.shops.length === 0) {
    throw new Error('eval input must include a non-empty shops array.')
  }

  const defaultMaxRequests = assertNonNegativeInteger(value.max_requests, 'max_requests')
  const shops = value.shops.map((shopValue, index) => {
    assertObject(shopValue, `shops[${index}]`)
    if (typeof shopValue.url !== 'string' || !shopValue.url.trim()) {
      throw new Error(`shops[${index}].url must be a URL string.`)
    }

    const url = new URL(shopValue.url)
    if (!url.hostname.endsWith('yupoo.com')) {
      throw new Error(`shops[${index}].url must be a yupoo.com URL.`)
    }

    const id = typeof shopValue.id === 'string' ? normalizeShopId(url.toString(), shopValue.id) : normalizeShopId(url.toString())
    const maxRequests = assertNonNegativeInteger(shopValue.max_requests, `shops[${index}].max_requests`)

    return {
      id,
      url: url.toString(),
      max_requests: maxRequests,
      expectations: normalizeExpectations(shopValue.expectations),
      notes: typeof shopValue.notes === 'string' ? shopValue.notes : undefined,
    }
  })

  return {
    max_requests: defaultMaxRequests,
    shops,
  }
}

export async function loadYupooShopEvalInput(filePath: string) {
  const raw = await readFile(filePath, 'utf8')
  return parseYupooShopEvalInput(JSON.parse(raw))
}

export function getTimestampRunDir(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-')
}

export function toRunDir(timestamp: string, baseDir = 'storage/codex-loop/yupoo-scrape-runs') {
  return path.join(baseDir, timestamp)
}

function includesLabel(labels: string[], expectedLabel: string) {
  const normalizedExpected = expectedLabel.trim().toLowerCase()
  return labels.some((label) => label.toLowerCase().includes(normalizedExpected))
}

export function summarizeYupooShopRun(input: {
  shop: YupooShopEvalCase
  result: YupooDiscoveryResult | null
  artifactPath: string
  durationMs: number
  error?: unknown
}): YupooShopRunSummary {
  const id = normalizeShopId(input.shop.url, input.shop.id)
  const expectations = input.shop.expectations ?? {}
  const labels = Array.from(new Set(input.result?.categories.map((category) => category.raw_label).filter(Boolean) ?? [])).sort()
  const categories = input.result?.categories ?? []
  const pages = input.result?.pages ?? []
  const pageFailures = pages
    .filter((page) => page.status === 'failed')
    .map((page) => ({ url: page.url, error: page.error, http_status: page.http_status }))
  const previewFetchedCategories = categories.filter((category) => category.preview_image_status === 'fetched')
  const previewImageCount = categories.reduce((count, category) => count + category.preview_image_urls.length, 0)
  const missingPreviewCategories = previewFetchedCategories
    .filter((category) => category.preview_image_urls.length === 0)
    .map((category) => ({ source_url: category.source_url, raw_label: category.raw_label }))
  const failureCodes: string[] = []

  if (input.error) failureCodes.push('scrape_exception')
  if (categories.length === 0) failureCodes.push('zero_categories')
  if (pageFailures.length > 0 && categories.length === 0) failureCodes.push('page_fetch_failures')
  if (expectations.min_categories != null && categories.length < expectations.min_categories) {
    failureCodes.push('below_min_categories')
  }
  if (
    expectations.min_preview_image_categories != null &&
    previewFetchedCategories.filter((category) => category.preview_image_urls.length > 0).length <
      expectations.min_preview_image_categories
  ) {
    failureCodes.push('below_min_preview_image_categories')
  }
  if (expectations.require_preview_images && previewImageCount === 0) {
    failureCodes.push('missing_required_preview_images')
  }

  const missingExpectedLabels = (expectations.expected_labels ?? []).filter((label) => !includesLabel(labels, label))
  if (missingExpectedLabels.length > 0) failureCodes.push('missing_expected_labels')

  return {
    id,
    url: input.shop.url,
    artifact_path: input.artifactPath,
    ok: failureCodes.length === 0,
    duration_ms: input.durationMs,
    page_count: pages.length,
    fetched_page_count: pages.filter((page) => page.status === 'fetched').length,
    failed_page_count: pageFailures.length,
    category_count: categories.length,
    supplier_count: input.result?.suppliers.length ?? 0,
    preview_fetched_category_count: previewFetchedCategories.length,
    preview_image_count: previewImageCount,
    labels,
    content_hashes: pages.flatMap((page) => (page.content_hash ? [page.content_hash] : [])),
    page_failures: pageFailures,
    missing_preview_categories: missingPreviewCategories,
    failure_codes: Array.from(new Set(failureCodes)).sort(),
    expectations,
    error: input.error instanceof Error ? input.error.message : input.error ? String(input.error) : null,
  }
}

export function analyzeYupooScrapeSummaries(runDir: string, summaries: YupooShopRunSummary[]): YupooScrapeEvalReport {
  const clusterMap = new Map<string, { code: string; count: number; shop_ids: string[] }>()

  for (const summary of summaries) {
    for (const code of summary.failure_codes) {
      const cluster = clusterMap.get(code) ?? { code, count: 0, shop_ids: [] }
      cluster.count += 1
      cluster.shop_ids.push(summary.id)
      clusterMap.set(code, cluster)
    }
  }

  return {
    run_dir: runDir,
    generated_at: new Date().toISOString(),
    total_shops: summaries.length,
    passed_shops: summaries.filter((summary) => summary.ok).length,
    failed_shops: summaries.filter((summary) => !summary.ok).length,
    common_failure_clusters: Array.from(clusterMap.values()).sort((left, right) => right.count - left.count),
    zero_category_shops: summaries.filter((summary) => summary.failure_codes.includes('zero_categories')).map((summary) => summary.id),
    missing_preview_image_cases: summaries.flatMap((summary) =>
      summary.missing_preview_categories.map((category) => ({ shop_id: summary.id, ...category })),
    ),
    blocked_or_failed_pages: summaries.flatMap((summary) =>
      summary.page_failures.map((failure) => ({ shop_id: summary.id, ...failure })),
    ),
    candidate_fixtures: summaries.flatMap((summary) =>
      summary.content_hashes.slice(0, 3).map((contentHash) => ({
        shop_id: summary.id,
        url: summary.url,
        content_hash: contentHash,
      })),
    ),
    shops: summaries,
  }
}

function toFailureClusterCounts(report: YupooScrapeEvalReport) {
  return new Map(report.common_failure_clusters.map((cluster) => [cluster.code, cluster.count]))
}

function compareClusterCounts(previous: YupooScrapeEvalReport, current: YupooScrapeEvalReport) {
  const previousCounts = toFailureClusterCounts(previous)
  const currentCounts = toFailureClusterCounts(current)
  const codes = Array.from(new Set([...previousCounts.keys(), ...currentCounts.keys()])).sort()
  const improved: YupooScrapeEvalComparison['improved_failure_clusters'] = []
  const worsened: YupooScrapeEvalComparison['worsened_failure_clusters'] = []

  for (const code of codes) {
    const previousCount = previousCounts.get(code) ?? 0
    const currentCount = currentCounts.get(code) ?? 0
    const delta = currentCount - previousCount

    if (delta < 0) {
      improved.push({ code, previous_count: previousCount, current_count: currentCount, delta })
    } else if (delta > 0) {
      worsened.push({ code, previous_count: previousCount, current_count: currentCount, delta })
    }
  }

  return { improved, worsened }
}

export function compareYupooScrapeEvalReports(input: {
  previous: YupooScrapeEvalReport
  current: YupooScrapeEvalReport
  unitTestsPassed: boolean
}): YupooScrapeEvalComparison {
  const previousById = new Map(input.previous.shops.map((shop) => [shop.id, shop]))
  const currentById = new Map(input.current.shops.map((shop) => [shop.id, shop]))
  const shopIds = Array.from(new Set([...previousById.keys(), ...currentById.keys()])).sort()
  const { improved, worsened } = compareClusterCounts(input.previous, input.current)

  const shopDeltas = shopIds.map((id) => {
    const previous = previousById.get(id)
    const current = currentById.get(id)
    const notes: string[] = []
    const categoryCountDelta = previous && current ? current.category_count - previous.category_count : null
    const previewImageCountDelta = previous && current ? current.preview_image_count - previous.preview_image_count : null
    const previewFetchedCategoryCountDelta =
      previous && current ? current.preview_fetched_category_count - previous.preview_fetched_category_count : null

    if (!previous) notes.push('new_shop')
    if (!current) notes.push('missing_current_shop')
    if (previous?.ok && !current?.ok) notes.push('previously_passing_now_failing')
    if (previous?.ok && categoryCountDelta != null && categoryCountDelta < 0) notes.push('category_count_regressed')
    if (previous?.ok && previewImageCountDelta != null && previewImageCountDelta < 0) notes.push('preview_image_count_regressed')
    if (previous?.ok && previewFetchedCategoryCountDelta != null && previewFetchedCategoryCountDelta < 0) {
      notes.push('preview_fetched_category_count_regressed')
    }
    if (!previous?.ok && current?.ok) notes.push('previously_failing_now_passing')
    if (!previous?.ok && current && previous && current.failure_codes.length < previous.failure_codes.length) {
      notes.push('fewer_failure_codes')
    }
    if (categoryCountDelta != null && categoryCountDelta > 0) notes.push('category_count_improved')
    if (previewImageCountDelta != null && previewImageCountDelta > 0) notes.push('preview_image_count_improved')
    if (previewFetchedCategoryCountDelta != null && previewFetchedCategoryCountDelta > 0) {
      notes.push('preview_fetched_category_count_improved')
    }

    const regressed = notes.some((note) => note.includes('regressed') || note === 'previously_passing_now_failing')
    const improved =
      notes.includes('previously_failing_now_passing') ||
      notes.includes('fewer_failure_codes') ||
      notes.some((note) => note.endsWith('_improved'))

    return {
      id,
      previous_ok: previous?.ok ?? null,
      current_ok: current?.ok ?? null,
      category_count_delta: categoryCountDelta,
      preview_image_count_delta: previewImageCountDelta,
      preview_fetched_category_count_delta: previewFetchedCategoryCountDelta,
      regressed,
      improved,
      notes,
    }
  })

  const previouslyPassingRegressions = shopDeltas
    .filter((delta) => delta.previous_ok === true && delta.regressed)
    .map((delta) => ({
      id: delta.id,
      category_count_delta: delta.category_count_delta,
      preview_image_count_delta: delta.preview_image_count_delta,
      preview_fetched_category_count_delta: delta.preview_fetched_category_count_delta,
      notes: delta.notes,
    }))
  const noPreviouslyPassingRegressions = previouslyPassingRegressions.length === 0
  const atLeastOneFailureClusterImproved = improved.length > 0 || shopDeltas.some((delta) => delta.improved)

  return {
    previous_run_dir: input.previous.run_dir,
    current_run_dir: input.current.run_dir,
    generated_at: new Date().toISOString(),
    passed_shop_delta: input.current.passed_shops - input.previous.passed_shops,
    failed_shop_delta: input.current.failed_shops - input.previous.failed_shops,
    improved_failure_clusters: improved,
    worsened_failure_clusters: worsened,
    shop_deltas: shopDeltas,
    previously_passing_regressions: previouslyPassingRegressions,
    acceptance: {
      unit_tests_passed: input.unitTestsPassed,
      no_previously_passing_regressions: noPreviouslyPassingRegressions,
      at_least_one_failure_cluster_improved: atLeastOneFailureClusterImproved,
      accepted: input.unitTestsPassed && noPreviouslyPassingRegressions && atLeastOneFailureClusterImproved,
    },
  }
}
