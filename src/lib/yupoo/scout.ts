import { createHash } from 'node:crypto'
import { DiscoveryBatchSchema, type DiscoveryBatchValues } from '../schemas/sourcing-discovery.ts'

const HREF_REGEX = /href\s*=\s*["']([^"']+)["']/gi
const ANCHOR_REGEX = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi
const IGNORED_SUBDOMAINS = new Set(['www', 'm'])
const SHOP_DISCOVERY_PATHS = ['/albums', '/albums?tab=gallery', '/contact', '/categories']
const PRIMARY_DISCOVERY_PATH = '/categories'
const MAX_DISCOVERY_DEPTH = 2
const MAX_CATEGORY_PREVIEW_IMAGES = 4
const DEFAULT_MAX_DISCOVERY_REQUESTS = 24
const DEFAULT_FETCH_TIMEOUT_MS = 15_000
const DEFAULT_FETCH_RETRY_ATTEMPTS = 2
const FETCH_RETRY_DELAY_MS = 250
const GENERIC_PATH_REF_SEGMENTS = new Set(['albums', 'categories', 'contact'])
const YUPOO_FETCH_HEADERS = {
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'accept-language': 'en-US,en;q=0.9',
  'user-agent':
    'Mozilla/5.0 (compatible; YupooOrganizer/1.0; +https://localhost)',
} as const
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

type FetchLike = typeof fetch

export type YupooScrapePageArtifact = {
  url: string
  status: 'fetched' | 'failed'
  http_status: number | null
  content_hash: string | null
  fetched_at: string
  discovered_urls: string[]
  categories_count: number
  suppliers_count: number
  error: string | null
  preview_debug: {
    page_is_concrete_category: boolean
    extracted_preview_urls: string[]
    matched_candidates: Array<{
      data_type: string | null
      raw_url: string | null
      absolute_url: string | null
      accepted: boolean
      reason: string
    }>
  } | null
}

export type YupooDiscoveryResult = DiscoveryBatchValues & {
  pages: YupooScrapePageArtifact[]
}

type PreviewDebugArtifact = NonNullable<YupooScrapePageArtifact['preview_debug']>

type QueuedDiscoveryRequest = {
  url: string
  depth: number
  sequence: number
}

type CategoryPreviewImageStatus = DiscoveryBatchValues['categories'][number]['preview_image_status']

function parseHrefUrls(html: string, baseUrl: string) {
  const links: string[] = []
  for (const match of html.matchAll(HREF_REGEX)) {
    const href = match[1]
    if (!href || href.startsWith('#')) continue

    try {
      const absolute = new URL(href, baseUrl)
      if (absolute.hostname.includes('yupoo.com')) links.push(absolute.toString())
    } catch {
      continue
    }
  }

  return links
}

function hashHtml(html: string) {
  return createHash('sha256').update(html).digest('hex')
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function extractAttribute(tagAttributes: string, attributeName: string) {
  const doubleQuoted = tagAttributes.match(new RegExp(`${attributeName}\\s*=\\s*"([^"]*)"`, 'i'))
  if (doubleQuoted?.[1] != null) return doubleQuoted[1]

  const singleQuoted = tagAttributes.match(new RegExp(`${attributeName}\\s*=\\s*'([^']*)'`, 'i'))
  return singleQuoted?.[1] ?? null
}

function extractClassNames(tagAttributes: string) {
  return new Set(
    (extractAttribute(tagAttributes, 'class') ?? '')
      .split(/\s+/)
      .map((className) => className.trim())
      .filter(Boolean),
  )
}

function decodeHtmlEntities(input: string) {
  return input
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
}

function stripTags(input: string) {
  return decodeHtmlEntities(input.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
}

function toCategoryPath(url: URL) {
  return url.pathname
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)
}

function isConcreteCategoryUrl(url: URL) {
  const categoryPath = toCategoryPath(url)
  const categoriesIndex = categoryPath.indexOf('categories')
  return categoriesIndex >= 0 && categoryPath.length > categoriesIndex + 1
}

function isSeedDiscoveryPath(url: URL) {
  return SHOP_DISCOVERY_PATHS.some((path) => {
    const candidate = new URL(path, url.origin)
    return candidate.pathname === url.pathname && candidate.search === url.search
  })
}

function isDiscoveryCandidateUrl(url: URL) {
  return isConcreteCategoryUrl(url) || isSeedDiscoveryPath(url)
}

function toSupplierKey(url: URL) {
  const hostname = url.hostname.toLowerCase()
  if (!hostname.endsWith('.yupoo.com')) return null

  const subdomain = hostname.slice(0, -'.yupoo.com'.length)
  if (!subdomain) return null
  if (IGNORED_SUBDOMAINS.has(subdomain)) return null

  return subdomain
}

function normalizeTextForRefs(input: string) {
  return Array.from(
    input
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase(),
  )
    .map((char) => LEET_CHAR_MAP[char] ?? char)
    .join('')
}

function isGenericCategoryLabel(label: string) {
  const normalized = normalizeTextForRefs(label).replace(/[^a-z0-9]+/g, '')
  return normalized === 'allcategories' || normalized === 'categories'
}

function toCategoryRefs(label: string, fallbackPath: string[] = []) {
  const normalized = normalizeTextForRefs(label)
  const baseTokens = normalized
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  const pathTokens = fallbackPath
    .map((segment) =>
      Array.from(
        segment
          .normalize('NFKD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase(),
      ).join(''),
    )
    .filter((segment) => !GENERIC_PATH_REF_SEGMENTS.has(segment))
    .filter((segment) => /[a-z]/.test(segment))
    .flatMap((segment) => segment.split(/[^a-z0-9]+/))
    .filter(Boolean)

  const refs = new Set<string>()
  const mergedTokens = [...baseTokens, ...pathTokens]

  let singleLetterBuffer = ''
  for (const token of mergedTokens) {
    if (token.length === 1) {
      singleLetterBuffer += token
      continue
    }

    if (singleLetterBuffer.length >= 2) refs.add(singleLetterBuffer)
    singleLetterBuffer = ''
    refs.add(token)
  }

  if (singleLetterBuffer.length >= 2) refs.add(singleLetterBuffer)

  const compact = normalized.replace(/[^a-z0-9]+/g, '')
  if (compact.length >= 3 && compact.length <= 24) refs.add(compact)

  return Array.from(refs)
}

function extractCategoryEntries(html: string, baseUrl: string) {
  const entries: Array<{ href: string | null; label: string }> = []

  for (const match of html.matchAll(ANCHOR_REGEX)) {
    const attributes = match[1] ?? ''
    const titleLabel = stripTags(extractAttribute(attributes, 'title') ?? '')
    const visibleLabel = stripTags(match[2] ?? '')
    const label = titleLabel || visibleLabel
    if (!label) continue

    entries.push({ href: extractAttribute(attributes, 'href'), label })
  }

  const filteredEntries: Array<{ href: string | null; label: string }> = []

  for (const entry of entries) {
    if (isGenericCategoryLabel(entry.label)) continue
    if (!entry.href) continue

    try {
      const url = new URL(entry.href, baseUrl)
      if (!isConcreteCategoryUrl(url)) continue
    } catch {
      continue
    }

    filteredEntries.push(entry)
  }

  return filteredEntries
}

function extractDivContentsByClass(html: string, targetClassName: string) {
  const contents: string[] = []
  const divTagRegex = /<\/?div\b[^>]*>/gi
  const stack: Array<{ classNames: Set<string>; contentStart: number }> = []

  for (const match of html.matchAll(divTagRegex)) {
    const tag = match[0]
    const startIndex = match.index ?? 0

    if (tag.startsWith('</')) {
      const openDiv = stack.pop()
      if (openDiv?.classNames.has(targetClassName)) {
        contents.push(html.slice(openDiv.contentStart, startIndex))
      }
      continue
    }

    stack.push({
      classNames: extractClassNames(tag),
      contentStart: startIndex + tag.length,
    })
  }

  return contents
}

function extractImageCandidateUrl(tagAttributes: string) {
  const directSrc =
    extractAttribute(tagAttributes, 'src') ??
    extractAttribute(tagAttributes, 'data-src') ??
    extractAttribute(tagAttributes, 'data-original') ??
    extractAttribute(tagAttributes, 'data-image')
  if (directSrc) return directSrc

  const style = extractAttribute(tagAttributes, 'style') ?? ''
  const styleUrl = style.match(/url\((['"]?)([^'")]+)\1\)/i)?.[2]
  return styleUrl ?? null
}

function collectCategoryPreviewDebug(html: string, baseUrl: string) {
  const previewUrls: string[] = []
  const seenUrls = new Set<string>()
  const matchedCandidates: PreviewDebugArtifact['matched_candidates'] = []
  const previewTagRegex = /<(?:div|img)\b([^>]*)>/gi

  for (const block of extractDivContentsByClass(html, 'categories__children')) {
    for (const match of block.matchAll(previewTagRegex)) {
      const attributes = match[1] ?? ''
      const classNames = extractClassNames(attributes)
      const isAlbumPreview = classNames.has('album__absolute') && classNames.has('album__img')
      const dataType = extractAttribute(attributes, 'data-type')
      const isPhotoPreview = dataType === 'photo'
      if (!isAlbumPreview && !isPhotoPreview) continue

      const rawUrl = extractImageCandidateUrl(attributes)
      if (!rawUrl) {
        matchedCandidates.push({
          data_type: dataType,
          raw_url: null,
          absolute_url: null,
          accepted: false,
          reason: 'missing_image_url',
        })
        continue
      }

      try {
        const absoluteUrl = new URL(rawUrl, baseUrl).toString()
        if (seenUrls.has(absoluteUrl)) {
          matchedCandidates.push({
            data_type: dataType,
            raw_url: rawUrl,
            absolute_url: absoluteUrl,
            accepted: false,
            reason: 'duplicate',
          })
          continue
        }
        seenUrls.add(absoluteUrl)
        previewUrls.push(absoluteUrl)
        matchedCandidates.push({
          data_type: dataType,
          raw_url: rawUrl,
          absolute_url: absoluteUrl,
          accepted: true,
          reason: isPhotoPreview ? 'data_type_photo' : 'album_preview_class',
        })
      } catch {
        matchedCandidates.push({
          data_type: dataType,
          raw_url: rawUrl,
          absolute_url: null,
          accepted: false,
          reason: 'invalid_url',
        })
        continue
      }

      if (previewUrls.length >= MAX_CATEGORY_PREVIEW_IMAGES) {
        return { previewUrls, matchedCandidates }
      }
    }
  }

  return { previewUrls, matchedCandidates }
}

function buildShopDiscoveryUrls(seedUrl: string) {
  const seed = new URL(seedUrl)
  const urls = new Set<string>()
  for (const candidate of [new URL(PRIMARY_DISCOVERY_PATH, seed.origin).toString()]) {
    const normalized = normalizeDiscoveryUrl(candidate, seed.origin)
    if (normalized) urls.add(normalized)
  }

  return Array.from(urls).sort((left, right) => {
    const leftUrl = new URL(left)
    const rightUrl = new URL(right)
    const primarySeedUrl = new URL(PRIMARY_DISCOVERY_PATH, seed.origin).toString()
    if (left === primarySeedUrl && right !== primarySeedUrl) return -1
    if (right === primarySeedUrl && left !== primarySeedUrl) return 1

    if (isConcreteCategoryUrl(leftUrl) !== isConcreteCategoryUrl(rightUrl)) {
      return isConcreteCategoryUrl(leftUrl) ? -1 : 1
    }

    return left.localeCompare(right)
  })
}

function buildFallbackDiscoveryUrls(seedUrl: string, currentUrl: string) {
  const seed = new URL(seedUrl)
  const current = new URL(currentUrl)

  return SHOP_DISCOVERY_PATHS
    .filter((path) => path !== PRIMARY_DISCOVERY_PATH)
    .map((path) => normalizeDiscoveryUrl(new URL(path, seed.origin).toString(), seed.origin))
    .filter((url): url is string => Boolean(url) && url !== current.toString())
}

function buildNextDiscoveryUrls(html: string, pageUrl: string, shopOrigin: string) {
  return Array.from(
    new Set(
      parseHrefUrls(html, pageUrl)
        .map((href) => normalizeDiscoveryUrl(href, shopOrigin))
        .filter((url): url is string => Boolean(url) && url !== pageUrl),
    ),
  ).sort((left, right) => {
    const leftIsConcrete = isConcreteCategoryUrl(new URL(left))
    const rightIsConcrete = isConcreteCategoryUrl(new URL(right))
    if (leftIsConcrete !== rightIsConcrete) return leftIsConcrete ? -1 : 1
    return left.localeCompare(right)
  })
}

function normalizeDiscoveryUrl(rawUrl: string, shopOrigin: string) {
  try {
    const url = new URL(rawUrl, shopOrigin)
    if (url.origin !== shopOrigin) return null
    if (!isDiscoveryCandidateUrl(url)) return null

    url.hash = ''

    if (isConcreteCategoryUrl(url)) {
      url.search = ''
      return url.toString()
    }

    if (url.pathname === '/albums' && url.searchParams.get('tab') === 'gallery') {
      url.search = '?tab=gallery'
      return url.toString()
    }

    url.search = ''
    return url.toString()
  } catch {
    return null
  }
}

function mergeSupplierRecord(
  existing: DiscoveryBatchValues['suppliers'][number] | undefined,
  next: DiscoveryBatchValues['suppliers'][number],
) {
  if (!existing) return next

  return {
    ...existing,
    category_refs: Array.from(new Set([...existing.category_refs, ...next.category_refs])),
    normalized_category_refs: Array.from(
      new Set([...existing.normalized_category_refs, ...next.normalized_category_refs]),
    ),
    last_seen_at: existing.last_seen_at > next.last_seen_at ? existing.last_seen_at : next.last_seen_at,
    confidence: Math.max(existing.confidence, next.confidence),
  }
}

function mergeCategoryRecord(
  existing: DiscoveryBatchValues['categories'][number] | undefined,
  next: DiscoveryBatchValues['categories'][number],
) {
  if (!existing) return next

  const previewImageStatus: CategoryPreviewImageStatus =
    existing.preview_image_status === 'fetched' || next.preview_image_status === 'fetched'
      ? 'fetched'
      : 'discovered_only'

  return {
    ...existing,
    ...next,
    raw_label: existing.raw_label || next.raw_label,
    confidence: Math.max(existing.confidence, next.confidence),
    preview_image_status: previewImageStatus,
    preview_image_urls:
      previewImageStatus === 'fetched'
        ? next.preview_image_status === 'fetched'
          ? next.preview_image_urls
          : existing.preview_image_urls
        : next.preview_image_urls.length > 0
          ? next.preview_image_urls
          : existing.preview_image_urls,
  }
}

export function extractDiscoveryFromHtml(html: string, baseUrl: string, extractedAt: string): DiscoveryBatchValues {
  const categories = new Map<string, DiscoveryBatchValues['categories'][number]>()
  const suppliers = new Map<string, DiscoveryBatchValues['suppliers'][number]>()
  const pageUrl = new URL(baseUrl)
  const shopSupplierKey = toSupplierKey(pageUrl)
  const pagePreviewDebug = isConcreteCategoryUrl(pageUrl)
    ? collectCategoryPreviewDebug(html, pageUrl.toString())
    : null
  const pagePreviewImageUrls = pagePreviewDebug?.previewUrls ?? []

  for (const entry of extractCategoryEntries(html, baseUrl)) {
    let categoryUrl: URL | null = null
    if (entry.href) {
      try {
        categoryUrl = new URL(entry.href, baseUrl)
      } catch {
        categoryUrl = null
      }
    }

    const categoryPath = categoryUrl ? toCategoryPath(categoryUrl) : toCategoryRefs(entry.label)
    const categoryRefs = toCategoryRefs(entry.label, categoryPath)
    if (categoryPath.length === 0) continue

    const sourceUrl = categoryUrl?.toString() ?? pageUrl.toString()
    const categoryKey = `${sourceUrl}::${categoryPath.join('/')}`
    categories.set(
      categoryKey,
      mergeCategoryRecord(categories.get(categoryKey), {
        source_url: sourceUrl,
        category_path: categoryPath,
        raw_label: entry.label,
        preview_image_urls: sourceUrl === pageUrl.toString() ? pagePreviewImageUrls : [],
        preview_image_status: sourceUrl === pageUrl.toString() ? 'fetched' : 'discovered_only',
        extracted_at: extractedAt,
        confidence: sourceUrl === pageUrl.toString() ? 0.9 : categoryUrl ? 0.7 : 0.75,
      }),
    )

    if (shopSupplierKey) {
      const supplierId = `${shopSupplierKey}::${pageUrl.origin}`
      suppliers.set(
        supplierId,
        mergeSupplierRecord(suppliers.get(supplierId), {
          supplier_key: shopSupplierKey,
          source_url: pageUrl.origin,
          category_refs: categoryRefs,
          normalized_category_refs: [],
          last_seen_at: extractedAt,
          confidence: 0.75,
        }),
      )
    }
  }

  if (suppliers.size === 0 && shopSupplierKey) {
    const fallbackRefs = toCategoryRefs(shopSupplierKey)
    const supplierId = `${shopSupplierKey}::${pageUrl.origin}`
    suppliers.set(supplierId, {
      supplier_key: shopSupplierKey,
      source_url: pageUrl.origin,
      category_refs: fallbackRefs,
      normalized_category_refs: [],
      last_seen_at: extractedAt,
      confidence: 0.55,
    })
  }

  if (categories.size === 0) {
    for (const rawUrl of parseHrefUrls(html, baseUrl)) {
      const url = new URL(rawUrl)
      const categoryPath = toCategoryPath(url)
      if (categoryPath.length === 0 || !isConcreteCategoryUrl(url)) continue
      const fallbackLabel = categoryPath.at(-1) ?? url.toString()
      if (isGenericCategoryLabel(fallbackLabel)) continue

      const categoryKey = `${url.toString()}::${categoryPath.join('/')}`
      categories.set(
        categoryKey,
        mergeCategoryRecord(categories.get(categoryKey), {
          source_url: url.toString(),
          category_path: categoryPath,
          raw_label: fallbackLabel,
          preview_image_urls: url.toString() === pageUrl.toString() ? pagePreviewImageUrls : [],
          preview_image_status: url.toString() === pageUrl.toString() ? 'fetched' : 'discovered_only',
          extracted_at: extractedAt,
          confidence: url.toString() === pageUrl.toString() ? 0.9 : 0.6,
        }),
      )
    }
  }

  if (isConcreteCategoryUrl(pageUrl)) {
    const pageCategoryPath = toCategoryPath(pageUrl)
    const pageCategoryKey = `${pageUrl.toString()}::${pageCategoryPath.join('/')}`
    categories.set(
      pageCategoryKey,
      mergeCategoryRecord(categories.get(pageCategoryKey), {
        source_url: pageUrl.toString(),
        category_path: pageCategoryPath,
        raw_label: categories.get(pageCategoryKey)?.raw_label ?? (pageCategoryPath.at(-1) || pageUrl.toString()),
        preview_image_urls: pagePreviewImageUrls,
        preview_image_status: 'fetched',
        extracted_at: extractedAt,
        confidence: 0.9,
      }),
    )
  }

  return DiscoveryBatchSchema.parse({
    categories: Array.from(categories.values()),
    suppliers: Array.from(suppliers.values()),
  })
}

function isTransientYupooFetchError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return (
    message === 'This operation was aborted' ||
    message === 'fetch failed' ||
    message === 'HTTP 408' ||
    message === 'HTTP 429' ||
    message === 'HTTP 500' ||
    message === 'HTTP 502' ||
    message === 'HTTP 503' ||
    message === 'HTTP 504' ||
    message === 'HTTP 522' ||
    message === 'HTTP 524' ||
    message === 'HTTP 525'
  )
}

async function fetchYupooHtmlOnce(url: string, fetchImpl: FetchLike) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), DEFAULT_FETCH_TIMEOUT_MS)

  try {
    const response = await fetchImpl(url, {
      cache: 'no-store',
      headers: YUPOO_FETCH_HEADERS,
      redirect: 'follow',
      signal: controller.signal,
    })
    const html = await response.text()

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    return {
      html,
      httpStatus: response.status,
      loadedUrl: response.url || url,
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function fetchYupooHtml(url: string, fetchImpl: FetchLike) {
  let lastError: unknown = null

  for (let attempt = 1; attempt <= DEFAULT_FETCH_RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await fetchYupooHtmlOnce(url, fetchImpl)
    } catch (error) {
      lastError = error
      if (attempt >= DEFAULT_FETCH_RETRY_ATTEMPTS || !isTransientYupooFetchError(error)) {
        throw error
      }
      await sleep(FETCH_RETRY_DELAY_MS * attempt)
    }
  }

  throw lastError
}

export async function scrapeYupooDiscovery(
  seedUrl: string,
  maxRequests = DEFAULT_MAX_DISCOVERY_REQUESTS,
  fetchImpl: FetchLike = fetch,
): Promise<YupooDiscoveryResult> {
  const shopOrigin = new URL(seedUrl).origin
  const requestLimit = Math.max(1, maxRequests)
  const queuedKeys = new Set<string>()
  const queue: QueuedDiscoveryRequest[] = []
  let sequence = 0

  const getQueuePriority = (url: string) => {
    const parsed = new URL(url)
    if (parsed.pathname === PRIMARY_DISCOVERY_PATH && parsed.search === '') return 0
    if (isConcreteCategoryUrl(parsed)) return 1
    return 2
  }

  const enqueue = (url: string, depth: number) => {
    if (queuedKeys.has(url)) return
    queuedKeys.add(url)
    queue.push({ url, depth, sequence: sequence++ })
    queue.sort((left, right) => {
      const priorityDelta = getQueuePriority(left.url) - getQueuePriority(right.url)
      if (priorityDelta !== 0) return priorityDelta
      if (left.depth !== right.depth) return left.depth - right.depth
      return left.sequence - right.sequence
    })
  }

  buildShopDiscoveryUrls(seedUrl)
    .slice(0, requestLimit)
    .forEach((url) => enqueue(url, 0))

  const categoryAccumulator = new Map<string, DiscoveryBatchValues['categories'][number]>()
  const supplierAccumulator = new Map<string, DiscoveryBatchValues['suppliers'][number]>()
  const pages: YupooScrapePageArtifact[] = []

  while (queue.length > 0 && pages.length < requestLimit) {
    const request = queue.shift()
    if (!request) continue

    const fetchedAt = new Date().toISOString()

    try {
      const { html, httpStatus, loadedUrl } = await fetchYupooHtml(request.url, fetchImpl)
      const pageUrl = normalizeDiscoveryUrl(loadedUrl, shopOrigin) ?? request.url
      const discovered = extractDiscoveryFromHtml(html, pageUrl, fetchedAt)
      const discoveredUrls = buildNextDiscoveryUrls(html, pageUrl, shopOrigin)
      const previewDebug: PreviewDebugArtifact = isConcreteCategoryUrl(new URL(pageUrl))
        ? (() => {
            const collected = collectCategoryPreviewDebug(html, pageUrl)
            return {
              page_is_concrete_category: true,
              extracted_preview_urls: collected.previewUrls,
              matched_candidates: collected.matchedCandidates,
            }
          })()
        : {
            page_is_concrete_category: false,
            extracted_preview_urls: [],
            matched_candidates: [],
          }

      discovered.categories.forEach((category) => {
        const key = `${category.source_url}::${category.category_path.join('/')}`
        categoryAccumulator.set(key, mergeCategoryRecord(categoryAccumulator.get(key), category))
      })

      discovered.suppliers.forEach((supplier) => {
        const key = `${supplier.supplier_key}::${supplier.source_url}`
        supplierAccumulator.set(key, mergeSupplierRecord(supplierAccumulator.get(key), supplier))
      })

      pages.push({
        url: pageUrl,
        status: 'fetched',
        http_status: httpStatus,
        content_hash: hashHtml(html),
        fetched_at: fetchedAt,
        discovered_urls: discoveredUrls,
        categories_count: discovered.categories.length,
        suppliers_count: discovered.suppliers.length,
        error: null,
        preview_debug: previewDebug,
      })

      if (request.depth >= MAX_DISCOVERY_DEPTH) continue

      if (
        request.depth === 0 &&
        new URL(pageUrl).pathname === PRIMARY_DISCOVERY_PATH &&
        discovered.categories.length === 0
      ) {
        buildFallbackDiscoveryUrls(seedUrl, pageUrl).forEach((url) => enqueue(url, request.depth + 1))
      }

      discoveredUrls.forEach((url) => enqueue(url, request.depth + 1))
    } catch (error) {
      const failedUrl = new URL(request.url)

      if (
        request.depth === 0 &&
        failedUrl.pathname === PRIMARY_DISCOVERY_PATH &&
        failedUrl.search === ''
      ) {
        buildFallbackDiscoveryUrls(seedUrl, request.url).forEach((url) => enqueue(url, request.depth + 1))
      }

      pages.push({
        url: request.url,
        status: 'failed',
        http_status: null,
        content_hash: null,
        fetched_at: fetchedAt,
        discovered_urls: [],
        categories_count: 0,
        suppliers_count: 0,
        error: error instanceof Error ? error.message : 'Failed to fetch Yupoo HTML.',
        preview_debug: null,
      })
    }
  }

  const parsed = DiscoveryBatchSchema.parse({
    categories: Array.from(categoryAccumulator.values()),
    suppliers: Array.from(supplierAccumulator.values()),
  })

  return {
    ...parsed,
    pages,
  }
}
