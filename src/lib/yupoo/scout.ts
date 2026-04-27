import { DiscoveryBatchSchema, type DiscoveryBatchValues } from '@/lib/schemas/sourcing-discovery'

const HREF_REGEX = /href\s*=\s*["']([^"']+)["']/gi
const ANCHOR_REGEX = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi
const IGNORED_SUBDOMAINS = new Set(['www', 'm'])
const CATEGORY_BOX_CLASS = 'categories__box-left'
const SHOP_DISCOVERY_PATHS = ['/albums', '/albums?tab=gallery', '/contact', '/categories']
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

function extractAttribute(tagAttributes: string, attributeName: string) {
  const regex = new RegExp(`${attributeName}\\s*=\\s*["']([^"']+)["']`, 'i')
  return tagAttributes.match(regex)?.[1] ?? null
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

function isCategoryUrl(url: URL) {
  return toCategoryPath(url).includes('categories')
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

function toCategoryRefs(label: string, fallbackPath: string[] = []) {
  const normalized = normalizeTextForRefs(label)
  const baseTokens = normalized
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  const pathTokens = fallbackPath
    .map((segment) => normalizeTextForRefs(segment))
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

function extractDivWithClass(html: string, className: string) {
  const classRegex = new RegExp(
    `<div\\b[^>]*class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>`,
    'i',
  )
  const match = classRegex.exec(html)
  if (!match || typeof match.index !== 'number') return null

  const tagRegex = /<div\b[^>]*>|<\/div>/gi
  tagRegex.lastIndex = match.index + match[0].length
  let depth = 1

  for (const tagMatch of html.slice(match.index + match[0].length).matchAll(tagRegex)) {
    const fullMatch = tagMatch[0]
    if (fullMatch.startsWith('</div')) {
      depth -= 1
    } else {
      depth += 1
    }

    if (depth === 0 && typeof tagMatch.index === 'number') {
      const start = match.index + match[0].length
      const end = start + tagMatch.index
      return html.slice(start, end)
    }
  }

  return null
}

function extractCategoryEntries(html: string, baseUrl: string) {
  const categorySection = extractDivWithClass(html, CATEGORY_BOX_CLASS)
  const source = categorySection ?? html
  const entries: Array<{ href: string | null; label: string }> = []

  for (const match of source.matchAll(ANCHOR_REGEX)) {
    const attributes = match[1] ?? ''
    const label = stripTags(match[2] ?? '')
    if (!label) continue

    const href = extractAttribute(attributes, 'href')
    if (!categorySection) {
      if (!href) continue
      try {
        const url = new URL(href, baseUrl)
        if (!isCategoryUrl(url)) continue
      } catch {
        continue
      }
    }

    entries.push({ href, label })
  }

  return entries
}

function buildShopDiscoveryUrls(seedUrl: string) {
  const seed = new URL(seedUrl)
  return SHOP_DISCOVERY_PATHS.map((path) => new URL(path, seed.origin).toString())
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

export function extractDiscoveryFromHtml(html: string, baseUrl: string, extractedAt: string): DiscoveryBatchValues {
  const categories = new Map<string, DiscoveryBatchValues['categories'][number]>()
  const suppliers = new Map<string, DiscoveryBatchValues['suppliers'][number]>()
  const pageUrl = new URL(baseUrl)
  const shopSupplierKey = toSupplierKey(pageUrl)

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
    categories.set(categoryKey, {
      source_url: sourceUrl,
      category_path: categoryPath,
      raw_label: entry.label,
      extracted_at: extractedAt,
      confidence: categoryUrl ? 0.9 : 0.75,
    })

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
      if (categoryPath.length === 0 || !isCategoryUrl(url)) continue

      const categoryKey = `${url.toString()}::${categoryPath.join('/')}`
      categories.set(categoryKey, {
        source_url: url.toString(),
        category_path: categoryPath,
        raw_label: categoryPath.at(-1) ?? url.toString(),
        extracted_at: extractedAt,
        confidence: 0.6,
      })
    }
  }

  return DiscoveryBatchSchema.parse({
    categories: Array.from(categories.values()),
    suppliers: Array.from(suppliers.values()),
  })
}

export async function crawlYupooDiscovery(seedUrl: string, maxRequests = 8): Promise<DiscoveryBatchValues> {
  const { CheerioCrawler, RequestQueue } = await import('crawlee')
  const requestQueue = await RequestQueue.open()
  const discoveryUrls = buildShopDiscoveryUrls(seedUrl).slice(0, Math.max(1, maxRequests))
  for (const url of discoveryUrls) {
    await requestQueue.addRequest({ url, uniqueKey: url })
  }

  const categoryAccumulator = new Map<string, DiscoveryBatchValues['categories'][number]>()
  const supplierAccumulator = new Map<string, DiscoveryBatchValues['suppliers'][number]>()

  const crawler = new CheerioCrawler({
    requestQueue,
    maxRequestsPerCrawl: maxRequests,
    async requestHandler({ $, request }) {
      const extractedAt = new Date().toISOString()
      const html = $.html()
      const discovered = extractDiscoveryFromHtml(html, request.loadedUrl ?? request.url, extractedAt)

      discovered.categories.forEach((category) => {
        const key = `${category.source_url}::${category.category_path.join('/')}`
        categoryAccumulator.set(key, category)
      })

      discovered.suppliers.forEach((supplier) => {
        const key = `${supplier.supplier_key}::${supplier.source_url}`
        supplierAccumulator.set(key, mergeSupplierRecord(supplierAccumulator.get(key), supplier))
      })
    },
  })

  await crawler.run()

  return DiscoveryBatchSchema.parse({
    categories: Array.from(categoryAccumulator.values()),
    suppliers: Array.from(supplierAccumulator.values()),
  })
}
