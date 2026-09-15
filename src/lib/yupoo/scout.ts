import { createHash } from 'node:crypto'
import { DiscoveryBatchSchema, type DiscoveryBatchValues } from '../schemas/sourcing-discovery.ts'
import { classifyDiscoveredCategory } from './classification.ts'

const HREF_REGEX = /href\s*=\s*["']([^"']+)["']/gi
const ANCHOR_REGEX = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi
const IGNORED_SUBDOMAINS = new Set(['www', 'm'])
const SHOP_DISCOVERY_PATHS = ['/albums', '/albums?tab=gallery', '/contact', '/categories']
const PRIMARY_DISCOVERY_PATH = '/categories'
const MAX_DISCOVERY_DEPTH = 2
const MAX_CATEGORY_PREVIEW_IMAGES = 4
const DEFAULT_MAX_DISCOVERY_REQUESTS = 24
const DEFAULT_DISCOVERY_CONCURRENCY = 4

function getDiscoveryConcurrency() {
  // Tunable without a code change: `YUPOO_DISCOVERY_CONCURRENCY=2` for slow/throttled networks.
  // Live-measured (2026-09-15): 4x halves wall time on small shops (west42 25s -> ~8s)
  // but large 600KB+ pages contend server-side, so 2x can be faster per-page there.
  const override = Number(process.env.YUPOO_DISCOVERY_CONCURRENCY)
  if (Number.isInteger(override) && override >= 1 && override <= 8) return override
  return DEFAULT_DISCOVERY_CONCURRENCY
}
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
    const rawHref = match[1]
    if (!rawHref || rawHref.startsWith('#')) continue

    // Yupoo renders some hrefs with HTML entities (e.g. `?isSubCate&#x3D;true&amp;navSource&#x3D;custom`).
    // Without decoding, `new URL` keeps the entities as literal query characters and every
    // downstream normalization/comparison silently mismatches.
    const href = decodeHtmlEntities(rawHref)
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
  if (categoriesIndex < 0 || categoryPath.length <= categoriesIndex + 1) return false
  // `/categories/0` is Yupoo's "Uncategorized album" bucket: a junk page that wastes
  // request budget and pollutes category records. Never treat it as a category.
  if (categoryPath[categoriesIndex + 1] === '0') return false
  return true
}

function isSeedDiscoveryPath(url: URL) {
  return SHOP_DISCOVERY_PATHS.some((path) => {
    const candidate = new URL(path, url.origin)
    return candidate.pathname === url.pathname && candidate.search === url.search
  })
}

function isIndexPaginationUrl(url: URL) {
  // Large shops paginate the index (`/categories?page=2`). Without following these,
  // every album past the first ~120 latest is invisible to discovery.
  if (url.pathname !== '/categories') return false
  const keys = Array.from(url.searchParams.keys())
  if (keys.length !== 1 || keys[0] !== 'page') return false
  const page = Number(url.searchParams.get('page'))
  return Number.isInteger(page) && page >= 2 && page <= 50
}

function isDiscoveryCandidateUrl(url: URL) {
  return isConcreteCategoryUrl(url) || isSeedDiscoveryPath(url) || isIndexPaginationUrl(url)
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

function toExtractionHintRefs(label: string, categoryPath: string[], sourceUrl: string) {
  const classified = classifyDiscoveredCategory({
    raw_label: label,
    category_path: categoryPath,
    source_url: sourceUrl,
  })
  const hints: string[] = []
  if (classified.product_signal) hints.push(classified.product_signal)
  if (classified.brand_signal && !hints.includes(classified.brand_signal)) {
    hints.push(classified.brand_signal)
  }
  return hints
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
      const url = new URL(decodeHtmlEntities(entry.href), baseUrl)
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

function isPreviewTag(attributes: string) {
  const classNames = extractClassNames(attributes)
  if (classNames.has('album__absolute') && classNames.has('album__img')) return true
  return extractAttribute(attributes, 'data-type') === 'photo'
}

function resolvePreviewImageUrl(attributes: string, baseUrl: string) {
  const rawUrl = extractImageCandidateUrl(attributes)
  if (!rawUrl) return null
  try {
    return new URL(rawUrl, baseUrl).toString()
  } catch {
    return null
  }
}

type AlbumCoverAttribution = {
  category_id: string
  image_url: string
}

function collectAlbumCoverAttributions(html: string, baseUrl: string): AlbumCoverAttribution[] {
  // Every `categories__children` album block links its album with
  // `referrercate=<categoryId>` (empty for uncategorized). The seed `/categories`
  // index renders up to ~120 latest album covers across the whole shop, but the
  // previous logic only extracted previews on concrete category pages — so those
  // 120 covers were downloaded, parsed for links, then thrown away. Attribute each
  // block's first cover image to its owning category instead.
  const attributions: AlbumCoverAttribution[] = []
  const previewTagRegex = /<(?:div|img)\b([^>]*)>/gi

  for (const block of extractDivContentsByClass(html, 'categories__children')) {
    const categoryId = block.match(/referrercate=(\d+)/)?.[1]
    if (!categoryId) continue

    for (const match of block.matchAll(previewTagRegex)) {
      const attributes = match[1] ?? ''
      if (!isPreviewTag(attributes)) continue
      const imageUrl = resolvePreviewImageUrl(attributes, baseUrl)
      if (imageUrl) {
        attributions.push({ category_id: categoryId, image_url: imageUrl })
        break
      }
    }
  }

  return attributions
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
  const seen = new Set<string>()
  const ordered: string[] = []
  // Preserve sidebar discovery order: Yupoo lists parent categories in shop-curated
  // order (featured/current first) with sub-categories nested beneath. The previous
  // alphabetical sort sent the request budget to the numerically-smallest IDs,
  // which on large shops are stale/deleted categories (empty pages and HTTP 404s),
  // while the shop's live categories were never reached. Stable-partition concrete
  // categories ahead of low-value seed paths instead of re-sorting.
  for (const href of parseHrefUrls(html, pageUrl)) {
    const normalized = normalizeDiscoveryUrl(href, shopOrigin)
    if (!normalized || normalized === pageUrl || seen.has(normalized)) continue
    seen.add(normalized)
    ordered.push(normalized)
  }

  const concrete = ordered.filter((url) => isConcreteCategoryUrl(new URL(url)))
  const rest = ordered.filter((url) => !isConcreteCategoryUrl(new URL(url)))
  return [...concrete, ...rest]
}

function normalizeDiscoveryUrl(rawUrl: string, shopOrigin: string) {
  try {
    const url = new URL(rawUrl, shopOrigin)
    if (url.origin !== shopOrigin) return null
    if (!isDiscoveryCandidateUrl(url)) return null

    url.hash = ''

    if (isConcreteCategoryUrl(url)) {
      // Sub-categories are served ONLY with `?isSubCate=true` — the canonical URL
      // without it returns HTTP 404 (verified live on yolo66: `/categories/943469`
      // 404s while `/categories/943469?isSubCate=true` returns 200). Stripping the
      // query therefore converts successful fetches into failures AND orphans the
      // discovered_only records that keep the query form. Preserve it as identity.
      // `page` is preserved for the same reason on paginated category views.
      const isSubCate = url.searchParams.get('isSubCate')
      const page = url.searchParams.get('page')
      url.search = ''
      if (isSubCate === 'true') url.searchParams.set('isSubCate', 'true')
      if (page != null && Number.isInteger(Number(page)) && Number(page) >= 2) {
        url.searchParams.set('page', String(Number(page)))
      }
      return url.toString()
    }

    if (url.pathname === '/categories' && url.searchParams.get('page')) {
      const page = Number(url.searchParams.get('page'))
      url.search = ''
      if (Number.isInteger(page) && page >= 2 && page <= 50) {
        url.searchParams.set('page', String(page))
      }
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

function attachIndexAlbumCovers(
  categories: Map<string, DiscoveryBatchValues['categories'][number]>,
  attributions: AlbumCoverAttribution[],
) {
  if (attributions.length === 0 || categories.size === 0) return

  const keyByCategoryId = new Map<string, string>()
  for (const [key, category] of categories) {
    const categoryId = category.category_path.at(-1)
    if (categoryId && !keyByCategoryId.has(categoryId)) keyByCategoryId.set(categoryId, key)
  }

  for (const attribution of attributions) {
    const key = keyByCategoryId.get(attribution.category_id)
    if (!key) continue
    const category = categories.get(key)
    if (!category) continue
    if (category.preview_image_urls.includes(attribution.image_url)) continue
    if (category.preview_image_urls.length >= MAX_CATEGORY_PREVIEW_IMAGES) continue
    category.preview_image_urls.push(attribution.image_url)
  }
}

export function extractDiscoveryFromHtml(html: string, baseUrl: string, extractedAt: string): DiscoveryBatchValues {
  const categories = new Map<string, DiscoveryBatchValues['categories'][number]>()
  const suppliers = new Map<string, DiscoveryBatchValues['suppliers'][number]>()
  const pageUrl = new URL(baseUrl)
  const shopSupplierKey = toSupplierKey(pageUrl)
  const pagePreviewDebug = collectCategoryPreviewDebug(html, pageUrl.toString())
  const pagePreviewImageUrls = pagePreviewDebug.previewUrls
  const pageSourceUrl = normalizeDiscoveryUrl(pageUrl.toString(), pageUrl.origin) ?? pageUrl.toString()

  const toRecordSourceUrl = (href: string | null): string | null => {
    if (!href) return null
    try {
      // Same normalization as the crawl queue: without it, sidebar hrefs such as
      // `/categories/943469?isSubCate=true` produce records whose source_url never
      // matches the fetched page URL, duplicating every sub-category.
      const parsed = new URL(decodeHtmlEntities(href), baseUrl)
      return normalizeDiscoveryUrl(parsed.toString(), pageUrl.origin)
    } catch {
      return null
    }
  }

  for (const entry of extractCategoryEntries(html, baseUrl)) {
    let categoryUrl: URL | null = null
    if (entry.href) {
      try {
        categoryUrl = new URL(decodeHtmlEntities(entry.href), baseUrl)
      } catch {
        categoryUrl = null
      }
    }

    const categoryPath = categoryUrl ? toCategoryPath(categoryUrl) : toCategoryRefs(entry.label)
    const categoryRefs = toCategoryRefs(entry.label, categoryPath)
    if (categoryPath.length === 0) continue

    const sourceUrl = toRecordSourceUrl(entry.href) ?? pageSourceUrl
    const categoryKey = `${sourceUrl}::${categoryPath.join('/')}`
    categories.set(
      categoryKey,
      mergeCategoryRecord(categories.get(categoryKey), {
        source_url: sourceUrl,
        category_path: categoryPath,
        raw_label: entry.label,
        preview_image_urls: sourceUrl === pageSourceUrl ? pagePreviewImageUrls : [],
        preview_image_status: sourceUrl === pageSourceUrl ? 'fetched' : 'discovered_only',
        extracted_at: extractedAt,
        confidence: sourceUrl === pageSourceUrl ? 0.9 : categoryUrl ? 0.7 : 0.75,
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
          normalized_category_refs: toExtractionHintRefs(entry.label, categoryPath, sourceUrl),
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
      normalized_category_refs: toExtractionHintRefs(shopSupplierKey, [shopSupplierKey], pageUrl.origin),
      last_seen_at: extractedAt,
      confidence: 0.55,
    })
  }

  if (categories.size === 0) {
    for (const rawUrl of parseHrefUrls(html, baseUrl)) {
      const normalized = normalizeDiscoveryUrl(rawUrl, pageUrl.origin)
      if (!normalized) continue
      const url = new URL(normalized)
      const categoryPath = toCategoryPath(url)
      if (categoryPath.length === 0 || !isConcreteCategoryUrl(url)) continue
      const fallbackLabel = categoryPath.at(-1) ?? normalized
      if (isGenericCategoryLabel(fallbackLabel)) continue

      const categoryKey = `${normalized}::${categoryPath.join('/')}`
      categories.set(
        categoryKey,
        mergeCategoryRecord(categories.get(categoryKey), {
          source_url: normalized,
          category_path: categoryPath,
          raw_label: fallbackLabel,
          preview_image_urls: normalized === pageSourceUrl ? pagePreviewImageUrls : [],
          preview_image_status: normalized === pageSourceUrl ? 'fetched' : 'discovered_only',
          extracted_at: extractedAt,
          confidence: normalized === pageSourceUrl ? 0.9 : 0.6,
        }),
      )
    }
  }

  if (isConcreteCategoryUrl(pageUrl)) {
    const pageCategoryPath = toCategoryPath(pageUrl)
    const pageCategoryKey = `${pageSourceUrl}::${pageCategoryPath.join('/')}`
    categories.set(
      pageCategoryKey,
      mergeCategoryRecord(categories.get(pageCategoryKey), {
        source_url: pageSourceUrl,
        category_path: pageCategoryPath,
        raw_label: categories.get(pageCategoryKey)?.raw_label ?? (pageCategoryPath.at(-1) || pageSourceUrl),
        preview_image_urls: pagePreviewImageUrls,
        preview_image_status: 'fetched',
        extracted_at: extractedAt,
        confidence: 0.9,
      }),
    )
  }

  attachIndexAlbumCovers(categories, collectAlbumCoverAttributions(html, pageUrl.toString()))

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
  const concurrency = getDiscoveryConcurrency()

  while (queue.length > 0 && pages.length < requestLimit) {
    // Bounded-parallel batches: Yupoo serves each page in ~0.6-4s and the previous
    // fully-sequential loop spent ~26s on 24 pages. Fetching queued URLs together
    // cuts wall time substantially (live-measured) while integration stays in queue
    // order, so crawl priority and page diagnostics remain deterministic.
    const batch = queue.splice(0, Math.min(concurrency, requestLimit - pages.length))
    const fetchedAt = new Date().toISOString()
    const settled = await Promise.all(
      batch.map(async (request) => {
        try {
          const fetched = await fetchYupooHtml(request.url, fetchImpl)
          return { request, ok: true as const, ...fetched }
        } catch (error) {
          return { request, ok: false as const, error }
        }
      }),
    )

    for (const entry of settled) {
      const { request } = entry
      if (!entry.ok) {
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
          error: entry.error instanceof Error ? entry.error.message : 'Failed to fetch Yupoo HTML.',
          preview_debug: null,
        })
        continue
      }

      const { html, httpStatus, loadedUrl } = entry
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
