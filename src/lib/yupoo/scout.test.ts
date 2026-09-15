import { beforeEach, describe, expect, it, vi } from 'vitest'

const scrapeState = {
  pages: new Map<string, string>(),
  processed: [] as string[],
}

function makeFetch() {
  return vi.fn(async (input: string | URL | Request) => {
    const url = input instanceof Request ? input.url : input.toString()
    scrapeState.processed.push(url)
    const html = scrapeState.pages.get(url)

    if (html == null) {
      return new Response('', { status: 404 })
    }

    return new Response(html, {
      status: 200,
      headers: { 'content-type': 'text/html' },
    })
  }) as unknown as typeof fetch
}

import { extractDiscoveryFromHtml, scrapeYupooDiscovery } from './scout'

describe('extractDiscoveryFromHtml', () => {
  beforeEach(() => {
    scrapeState.pages.clear()
    scrapeState.processed = []
  })

  it('extracts category labels from the Yupoo categories sidebar and normalizes obfuscated refs', () => {
    const html = `
      <div class="categories__box-left">
        <div class="yupoo-collapse-item">
          <a href="/categories/987" title="B4G$">15</a>
        </div>
        <div class="yupoo-collapse-item">
          <a href="/categories/123" title="L V Shoes">17</a>
        </div>
      </div>
      <a href="https://example.com/nope">Non-yupoo</a>
    `

    const extracted = extractDiscoveryFromHtml(html, 'https://abcstore.x.yupoo.com/categories', '2026-04-23T00:00:00.000Z')

    expect(extracted.categories.length).toBe(2)
    expect(extracted.categories[0]?.source_url).toContain('/categories/')
    expect(extracted.categories[0]?.raw_label).toBe('B4G$')
    expect(extracted.suppliers).toHaveLength(1)
    expect(extracted.suppliers[0]?.supplier_key).toBe('abcstore.x')
    expect(extracted.suppliers[0]?.normalized_category_refs).toEqual(
      expect.arrayContaining(['bags', 'lv', 'shoes']),
    )
    expect(extracted.suppliers[0]?.category_refs).toEqual(
      expect.arrayContaining(['bags', 'lv', 'shoes']),
    )
  })

  it('deduplicates repeated category urls and merges normalized refs', () => {
    const html = `
      <div class="categories__box-left">
        <div class="yupoo-collapse-item">
          <a href="https://bagsshop.x.yupoo.com/categories/111" title="Bags">15</a>
        </div>
        <div class="yupoo-collapse-item">
          <a href="https://bagsshop.x.yupoo.com/categories/111" title="B4G$">16</a>
        </div>
      </div>
    `

    const extracted = extractDiscoveryFromHtml(html, 'https://bagsshop.x.yupoo.com/categories', '2026-04-23T00:00:00.000Z')

    expect(extracted.categories).toHaveLength(1)
    expect(extracted.suppliers).toHaveLength(1)
    expect(extracted.suppliers[0]?.category_refs.filter((ref) => ref === 'bags')).toHaveLength(1)
    expect(extracted.suppliers[0]?.normalized_category_refs).toEqual(['bags'])
  })

  it('does not derive supplier refs from generic or numeric category path segments', () => {
    const html = `
      <div class="categories__box-left">
        <div class="yupoo-collapse-item">
          <a href="https://west42.x.yupoo.com/categories/4733646" title="Ski Recommendation">15</a>
        </div>
      </div>
    `

    const extracted = extractDiscoveryFromHtml(
      html,
      'https://west42.x.yupoo.com/categories',
      '2026-04-27T00:00:00.000Z',
    )

    expect(extracted.suppliers[0]?.category_refs).toEqual(
      expect.arrayContaining(['ski', 'recommendation', 'skirecommendation']),
    )
    expect(extracted.suppliers[0]?.category_refs).not.toEqual(
      expect.arrayContaining(['categories', '4733646', 'ateegag']),
    )
  })

  it('falls back to generic category links when the categories sidebar is missing', () => {
    const html = `
      <a href="https://bagsshop.x.yupoo.com/categories/111">Bags</a>
      <a href="https://bagsshop.x.yupoo.com/albums">Albums</a>
    `

    const extracted = extractDiscoveryFromHtml(html, 'https://bagsshop.x.yupoo.com/albums', '2026-04-23T00:00:00.000Z')

    expect(extracted.categories).toHaveLength(1)
    expect(extracted.suppliers).toHaveLength(1)
    expect(extracted.suppliers[0]?.supplier_key).toBe('bagsshop.x')
  })

  it('preserves the full shop subdomain chain in supplier identity', () => {
    const html = `
      <div class="categories__box-left">
        <a href="/categories/100">Bags</a>
      </div>
    `

    const extracted = extractDiscoveryFromHtml(
      html,
      'https://west42.x.yupoo.com/',
      '2026-04-27T00:00:00.000Z',
    )

    expect(extracted.suppliers).toHaveLength(1)
    expect(extracted.suppliers[0]?.supplier_key).toBe('west42.x')
    expect(extracted.suppliers[0]?.source_url).toBe('https://west42.x.yupoo.com')
  })

  it('ignores album links and generic all-categories links inside the sidebar', () => {
    const html = `
      <div class="categories__box-left">
        <div class="yupoo-collapse-item">
          <a href="/categories" title="All categories">All categories</a>
        </div>
        <div class="yupoo-collapse-item">
          <a href="/categories/4733646" title="Ski Recommendation">15</a>
        </div>
        <div class="yupoo-collapse-item">
          <a href="/albums/233762240?uid=1&amp;isSubCate=false&amp;referrercate=" title="15">15</a>
        </div>
      </div>
    `

    const extracted = extractDiscoveryFromHtml(
      html,
      'https://west42.x.yupoo.com/categories',
      '2026-04-27T00:00:00.000Z',
    )

    expect(extracted.categories).toHaveLength(1)
    expect(extracted.categories[0]).toMatchObject({
      source_url: 'https://west42.x.yupoo.com/categories/4733646',
      raw_label: 'Ski Recommendation',
      category_path: ['categories', '4733646'],
    })
    expect(extracted.suppliers[0]?.category_refs).not.toEqual(
      expect.arrayContaining(['all', 'categories', 'albums', '15']),
    )
  })

  it('uses the anchor title attribute when the visible sidebar label is numeric', () => {
    const html = `
      <div class="categories__box-left">
        <div class="yupoo-collapse-item">
          <a href="/categories/111" title="Scarves">15</a>
        </div>
        <div class="yupoo-collapse-item">
          <a href="/categories/112" title="Beanies">17</a>
        </div>
      </div>
    `

    const extracted = extractDiscoveryFromHtml(
      html,
      'https://west42.x.yupoo.com/categories',
      '2026-04-27T00:00:00.000Z',
    )

    expect(extracted.categories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source_url: 'https://west42.x.yupoo.com/categories/111',
          raw_label: 'Scarves',
          category_path: ['categories', '111'],
          preview_image_urls: [],
          preview_image_status: 'discovered_only',
        }),
        expect.objectContaining({
          source_url: 'https://west42.x.yupoo.com/categories/112',
          raw_label: 'Beanies',
          category_path: ['categories', '112'],
          preview_image_urls: [],
          preview_image_status: 'discovered_only',
        }),
      ]),
    )
  })

  it('scrapes preview image urls from concrete category pages', () => {
    const html = `
      <div class="categories__children">
        <div class="album__absolute album__img" style="background-image:url('/preview-1.jpg')"></div>
        <img class="album__absolute album__img" src="https://west42.x.yupoo.com/preview-2.jpg" />
      </div>
    `

    const extracted = extractDiscoveryFromHtml(
      `
        <div class="categories__box-left">
          <a href="/categories/111" title="Scarves">15</a>
        </div>
        ${html}
      `,
      'https://west42.x.yupoo.com/categories/111',
      '2026-04-27T00:00:00.000Z',
    )

    expect(extracted.categories).toEqual([
      expect.objectContaining({
        source_url: 'https://west42.x.yupoo.com/categories/111',
        preview_image_urls: [
          'https://west42.x.yupoo.com/preview-1.jpg',
          'https://west42.x.yupoo.com/preview-2.jpg',
        ],
        preview_image_status: 'fetched',
      }),
    ])
  })

  it('deduplicates repeated preview image urls and ignores images outside the target container', () => {
    const extracted = extractDiscoveryFromHtml(
      `
        <div class="album__absolute album__img" style="background-image:url('/ignored.jpg')"></div>
        <div class="categories__box-left">
          <a href="/categories/111" title="Scarves">15</a>
        </div>
        <div class="categories__children">
          <div class="album__absolute album__img" data-src="/preview-1.jpg"></div>
          <div class="album__absolute album__img" data-src="https://west42.x.yupoo.com/preview-1.jpg"></div>
          <div class="album__absolute" data-src="/ignored-2.jpg"></div>
        </div>
      `,
      'https://west42.x.yupoo.com/categories/111',
      '2026-04-27T00:00:00.000Z',
    )

    expect(extracted.categories[0]?.preview_image_urls).toEqual([
      'https://west42.x.yupoo.com/preview-1.jpg',
    ])
    expect(extracted.categories[0]?.preview_image_status).toBe('fetched')
  })

  it('extracts preview image urls from data-type photo entries', () => {
    const extracted = extractDiscoveryFromHtml(
      `
        <div class="categories__box-left">
          <a href="/categories/4791339" title="25SS Beta SL/LW">15</a>
        </div>
        <div class="categories__children">
          <div data-type="photo" data-src="https://photo.yupoo.com/west42/beta-1/medium.jpg"></div>
          <img data-type="photo" src="/beta-2.jpg" />
          <div data-type="video" data-src="/ignored.mp4"></div>
        </div>
      `,
      'https://west42.x.yupoo.com/categories/4791339',
      '2026-04-27T00:00:00.000Z',
    )

    expect(extracted.categories[0]?.preview_image_urls).toEqual([
      'https://photo.yupoo.com/west42/beta-1/medium.jpg',
      'https://west42.x.yupoo.com/beta-2.jpg',
    ])
    expect(extracted.categories[0]?.preview_image_status).toBe('fetched')
  })

  it('returns an empty preview array when a concrete category page has no qualifying images', () => {
    const extracted = extractDiscoveryFromHtml(
      `
        <div class="categories__box-left">
          <a href="/categories/111" title="Scarves">15</a>
        </div>
        <div class="categories__children">
          <img class="other-class" src="/ignored.jpg" />
        </div>
      `,
      'https://west42.x.yupoo.com/categories/111',
      '2026-04-27T00:00:00.000Z',
    )

    expect(extracted.categories[0]?.preview_image_urls).toEqual([])
    expect(extracted.categories[0]?.preview_image_status).toBe('fetched')
  })

  it('enqueues same-shop category pages discovered from seeded pages', async () => {
    scrapeState.pages.set(
      'https://west42.x.yupoo.com/albums',
      `
        <a href="/categories/100">Bags</a>
        <a href="/categories/200?ref=gallery">Shoes</a>
        <a href="https://elsewhere.yupoo.com/categories/999">Ignore</a>
      `,
    )
    scrapeState.pages.set('https://west42.x.yupoo.com/contact', '<div>Contact</div>')
    scrapeState.pages.set('https://west42.x.yupoo.com/categories', '<a href="/categories">All categories</a>')
    scrapeState.pages.set(
      'https://west42.x.yupoo.com/categories/100',
      '<div class="categories__box-left"><div class="yupoo-collapse-item"><a href="/categories/100" title="Bags">15</a></div></div>',
    )
    scrapeState.pages.set(
      'https://west42.x.yupoo.com/categories/200',
      '<div class="categories__box-left"><div class="yupoo-collapse-item"><a href="/categories/200" title="Shoes">17</a></div></div>',
    )

    const extracted = await scrapeYupooDiscovery('https://west42.x.yupoo.com/', 8, makeFetch())

    expect(scrapeState.processed).toEqual(
      expect.arrayContaining([
        'https://west42.x.yupoo.com/categories/100',
        'https://west42.x.yupoo.com/categories/200',
      ]),
    )
    expect(scrapeState.processed).not.toEqual(
      expect.arrayContaining(['https://elsewhere.yupoo.com/categories/999']),
    )
    expect(extracted.categories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source_url: 'https://west42.x.yupoo.com/categories/100' }),
        expect.objectContaining({ source_url: 'https://west42.x.yupoo.com/categories/200' }),
      ]),
    )
  })

  it('records per-page scrape diagnostics for fetched Yupoo HTML', async () => {
    scrapeState.pages.set(
      'https://west42.x.yupoo.com/categories',
      `
        <div class="categories__box-left">
          <a href="/categories/111" title="Scarves">15</a>
        </div>
      `,
    )
    scrapeState.pages.set(
      'https://west42.x.yupoo.com/categories/111',
      `
        <div class="categories__box-left">
          <a href="/categories/111" title="Scarves">15</a>
        </div>
        <div class="categories__children">
          <img data-type="photo" src="/preview-1.jpg" />
          <img data-type="photo" src="/preview-1.jpg" />
          <div data-type="photo"></div>
        </div>
      `,
    )

    const extracted = await scrapeYupooDiscovery('https://west42.x.yupoo.com/', 2, makeFetch())

    expect(extracted.pages).toEqual(expect.arrayContaining([
      expect.objectContaining({
        url: 'https://west42.x.yupoo.com/categories',
        status: 'fetched',
        http_status: 200,
        content_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
        categories_count: 1,
      }),
      expect.objectContaining({
        url: 'https://west42.x.yupoo.com/categories/111',
        preview_debug: expect.objectContaining({
          page_is_concrete_category: true,
          extracted_preview_urls: ['https://west42.x.yupoo.com/preview-1.jpg'],
          matched_candidates: expect.arrayContaining([
            expect.objectContaining({
              accepted: true,
              reason: 'data_type_photo',
            }),
            expect.objectContaining({
              accepted: false,
              reason: 'duplicate',
            }),
            expect.objectContaining({
              accepted: false,
              reason: 'missing_image_url',
            }),
          ]),
        }),
      }),
    ]))
  })

  it('prioritizes concrete category pages ahead of low-value discovery pages when request budget is tight', async () => {
    scrapeState.pages.set(
      'https://west42.x.yupoo.com/categories',
      `
        <div class="categories__box-left">
          <a href="/categories/100" title="Bags">15</a>
          <a href="/categories/200" title="Shoes">17</a>
          <a href="/categories/300" title="Wallets">19</a>
        </div>
        <a href="/contact">Contact</a>
        <a href="/albums?tab=gallery">Gallery</a>
      `,
    )
    scrapeState.pages.set(
      'https://west42.x.yupoo.com/categories/100',
      '<div class="categories__box-left"><a href="/categories/100" title="Bags">15</a></div>',
    )
    scrapeState.pages.set(
      'https://west42.x.yupoo.com/categories/200',
      '<div class="categories__box-left"><a href="/categories/200" title="Shoes">17</a></div>',
    )
    scrapeState.pages.set(
      'https://west42.x.yupoo.com/categories/300',
      '<div class="categories__box-left"><a href="/categories/300" title="Wallets">19</a></div>',
    )
    scrapeState.pages.set('https://west42.x.yupoo.com/contact', '<div>Contact</div>')
    scrapeState.pages.set('https://west42.x.yupoo.com/albums?tab=gallery', '<div>Gallery</div>')

    await scrapeYupooDiscovery('https://west42.x.yupoo.com/', 4, makeFetch())

    expect(scrapeState.processed).toEqual([
      'https://west42.x.yupoo.com/categories',
      'https://west42.x.yupoo.com/categories/100',
      'https://west42.x.yupoo.com/categories/200',
      'https://west42.x.yupoo.com/categories/300',
    ])
  })

  it('fetches late-listed category pages before fallback discovery pages under the default budget', async () => {
    const lateCategoryPage = 'https://west42.x.yupoo.com/categories/4791339'

    scrapeState.pages.set(
      'https://west42.x.yupoo.com/categories',
      `
        <div class="categories__box-left">
          <a href="/categories/100" title="Bags">1</a>
          <a href="/categories/101" title="Shoes">2</a>
          <a href="/categories/102" title="Wallets">3</a>
          <a href="/categories/103" title="Belts">4</a>
          <a href="/categories/104" title="Denim">5</a>
          <a href="/categories/105" title="Outerwear">6</a>
          <a href="/categories/4791339" title="25SS Beta SL/LW">7</a>
          <a href="/categories/4910812" title="Category 8">8</a>
          <a href="/categories/5055567" title="Category 9">9</a>
          <a href="/categories/5083717" title="Category 10">10</a>
          <a href="/categories/5103683" title="Category 11">11</a>
          <a href="/categories/5139355" title="Category 12">12</a>
          <a href="/categories/5200001" title="Category 13">13</a>
          <a href="/categories/5200002" title="Category 14">14</a>
          <a href="/categories/5200003" title="Category 15">15</a>
          <a href="/categories/5200004" title="Category 16">16</a>
        </div>
        <a href="/albums">Albums</a>
        <a href="/contact">Contact</a>
      `,
    )

    for (const id of [
      '100',
      '101',
      '102',
      '103',
      '104',
      '105',
      '4910812',
      '5055567',
      '5083717',
      '5103683',
      '5139355',
      '5200001',
      '5200002',
      '5200003',
      '5200004',
    ]) {
      scrapeState.pages.set(
        `https://west42.x.yupoo.com/categories/${id}`,
        `<div class="categories__box-left"><a href="/categories/${id}" title="Category ${id}">${id}</a></div>`,
      )
    }

    scrapeState.pages.set(
      lateCategoryPage,
      `
        <div class="categories__box-left">
          <a href="/categories/4791339" title="25SS Beta SL/LW">7</a>
        </div>
        <div class="categories__children">
          <img class="album__absolute album__img" src="/beta-sl.jpg" />
        </div>
      `,
    )
    scrapeState.pages.set('https://west42.x.yupoo.com/albums', '<div>Albums</div>')
    scrapeState.pages.set('https://west42.x.yupoo.com/contact', '<div>Contact</div>')

    const extracted = await scrapeYupooDiscovery('https://west42.x.yupoo.com/', undefined, makeFetch())

    const lateCategoryIndex = scrapeState.processed.indexOf(lateCategoryPage)
    const albumsIndex = scrapeState.processed.indexOf('https://west42.x.yupoo.com/albums')
    const contactIndex = scrapeState.processed.indexOf('https://west42.x.yupoo.com/contact')

    expect(scrapeState.processed).toContain(lateCategoryPage)
    expect(lateCategoryIndex).toBeGreaterThanOrEqual(0)
    expect(albumsIndex === -1 || lateCategoryIndex < albumsIndex).toBe(true)
    expect(contactIndex === -1 || lateCategoryIndex < contactIndex).toBe(true)
    expect(extracted.categories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source_url: lateCategoryPage,
          preview_image_status: 'fetched',
          preview_image_urls: ['https://west42.x.yupoo.com/beta-sl.jpg'],
        }),
      ]),
    )
  })

  it('falls back to albums when the primary categories page fails', async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = input instanceof Request ? input.url : input.toString()
      scrapeState.processed.push(url)

      if (url === 'https://west42.x.yupoo.com/categories') {
        return new Response('', { status: 525 })
      }

      if (url === 'https://west42.x.yupoo.com/albums') {
        return new Response('<a href="/categories/111">Scarves</a>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        })
      }

      if (url === 'https://west42.x.yupoo.com/categories/111') {
        return new Response(
          `
            <div class="categories__box-left">
              <a href="/categories/111" title="Scarves">15</a>
            </div>
            <div class="categories__children">
              <img data-type="photo" src="/scarves.jpg" />
            </div>
          `,
          {
            status: 200,
            headers: { 'content-type': 'text/html' },
          },
        )
      }

      return new Response('', { status: 404 })
    }) as unknown as typeof fetch

    const extracted = await scrapeYupooDiscovery('https://west42.x.yupoo.com/', 6, fetchImpl)

    expect(scrapeState.processed).toEqual(
      expect.arrayContaining([
        'https://west42.x.yupoo.com/categories',
        'https://west42.x.yupoo.com/albums',
        'https://west42.x.yupoo.com/categories/111',
      ]),
    )
    expect(extracted.pages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          url: 'https://west42.x.yupoo.com/categories',
          status: 'failed',
          error: 'HTTP 525',
        }),
      ]),
    )
    expect(extracted.categories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source_url: 'https://west42.x.yupoo.com/categories/111',
          preview_image_urls: ['https://west42.x.yupoo.com/scarves.jpg'],
          preview_image_status: 'fetched',
        }),
      ]),
    )
  })

  it('retries transient Yupoo edge failures before recording a page failure', async () => {
    const attempts = new Map<string, number>()
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = input instanceof Request ? input.url : input.toString()
      const attempt = (attempts.get(url) ?? 0) + 1
      attempts.set(url, attempt)
      scrapeState.processed.push(url)

      if (url === 'https://west42.x.yupoo.com/categories' && attempt === 1) {
        return new Response('', { status: 522 })
      }

      return new Response(
        `
          <div class="categories__box-left">
            <a href="/categories/111" title="Scarves">15</a>
          </div>
        `,
        {
          status: 200,
          headers: { 'content-type': 'text/html' },
        },
      )
    }) as unknown as typeof fetch

    const extracted = await scrapeYupooDiscovery('https://west42.x.yupoo.com/', 1, fetchImpl)

    expect(attempts.get('https://west42.x.yupoo.com/categories')).toBe(2)
    expect(extracted.pages).toEqual([
      expect.objectContaining({
        url: 'https://west42.x.yupoo.com/categories',
        status: 'fetched',
        error: null,
        categories_count: 1,
      }),
    ])
  })

  it('marks discovered-only categories without fetched previews as non-confirmed empties', () => {
    const extracted = extractDiscoveryFromHtml(
      `
        <div class="categories__box-left">
          <a href="/categories/4791339" title="25SS Beta SL/LW">7</a>
        </div>
      `,
      'https://west42.x.yupoo.com/categories',
      '2026-04-27T00:00:00.000Z',
    )

    expect(extracted.categories).toEqual([
      expect.objectContaining({
        source_url: 'https://west42.x.yupoo.com/categories/4791339',
        preview_image_urls: [],
        preview_image_status: 'discovered_only',
        confidence: 0.7,
      }),
    ])
  })
})

describe('yupoo subcategory tuning', () => {
  beforeEach(() => {
    scrapeState.pages.clear()
    scrapeState.processed = []
  })

  it('preserves ?isSubCate=true when fetching sub-categories instead of 404ing the canonical url', async () => {
    scrapeState.pages.set(
      'https://yolo66.x.yupoo.com/categories',
      `
        <div class="categories__box-left">
          <a href="/categories/5188236" title="Luxury">1</a>
          <a href="/categories/943469?isSubCate=true" title="Clothes Yupoo">2</a>
        </div>
      `,
    )
    scrapeState.pages.set(
      'https://yolo66.x.yupoo.com/categories/943469?isSubCate=true',
      `
        <div class="categories__box-left">
          <a href="/categories/943469?isSubCate=true" title="Clothes Yupoo">2</a>
        </div>
        <div class="categories__children">
          <a class="album__main" href="/albums/1?uid=1&amp;isSubCate=false&amp;referrercate=943469">
            <img data-type="photo" data-src="https://photo.yupoo.com/yolo66/abc123/small.jpg" />
          </a>
        </div>
      `,
    )
    scrapeState.pages.set(
      'https://yolo66.x.yupoo.com/categories/5188236',
      '<div class="categories__box-left"><a href="/categories/5188236" title="Luxury">1</a></div>',
    )

    const extracted = await scrapeYupooDiscovery('https://yolo66.x.yupoo.com/', 3, makeFetch())

    expect(scrapeState.processed).toContain('https://yolo66.x.yupoo.com/categories/943469?isSubCate=true')
    expect(scrapeState.processed).not.toContain('https://yolo66.x.yupoo.com/categories/943469')
    expect(extracted.pages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          url: 'https://yolo66.x.yupoo.com/categories/943469?isSubCate=true',
          status: 'fetched',
        }),
      ]),
    )
    expect(extracted.categories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source_url: 'https://yolo66.x.yupoo.com/categories/943469?isSubCate=true',
          raw_label: 'Clothes Yupoo',
          preview_image_status: 'fetched',
          preview_image_urls: ['https://photo.yupoo.com/yolo66/abc123/small.jpg'],
        }),
      ]),
    )
  })

  it('decodes html entities in hrefs before normalizing discovery urls', async () => {
    scrapeState.pages.set(
      'https://yolo66.x.yupoo.com/categories',
      `
        <div class="categories__box-left">
          <a href="/categories/943471?isSubCate&#x3D;true&amp;navSource&#x3D;custom" title="Luxury Shoes">2</a>
        </div>
      `,
    )
    scrapeState.pages.set(
      'https://yolo66.x.yupoo.com/categories/943471?isSubCate=true',
      '<div class="categories__box-left"><a href="/categories/943471?isSubCate=true" title="Luxury Shoes">2</a></div>',
    )

    const extracted = await scrapeYupooDiscovery('https://yolo66.x.yupoo.com/', 2, makeFetch())

    expect(scrapeState.processed).toContain('https://yolo66.x.yupoo.com/categories/943471?isSubCate=true')
    expect(extracted.pages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          url: 'https://yolo66.x.yupoo.com/categories/943471?isSubCate=true',
          status: 'fetched',
        }),
      ]),
    )
  })

  it('attributes index album covers to owning sub-categories via referrercate', () => {
    const extracted = extractDiscoveryFromHtml(
      `
        <div class="categories__box-left">
          <a href="/categories/5188236" title="Luxury">1</a>
          <a href="/categories/943469?isSubCate=true" title="Clothes Yupoo">2</a>
        </div>
        <div class="categories__children">
          <a class="album__main" href="/albums/111?uid=1&amp;isSubCate=false&amp;referrercate=943469">
            <img data-type="photo" data-src="https://photo.yupoo.com/yolo66/cover1/small.jpg" />
          </a>
        </div>
        <div class="categories__children">
          <a class="album__main" href="/albums/222?uid=1&amp;isSubCate=false&amp;referrercate=">
            <img data-type="photo" data-src="https://photo.yupoo.com/yolo66/uncategorized/small.jpg" />
          </a>
        </div>
      `,
      'https://yolo66.x.yupoo.com/categories',
      '2026-04-27T00:00:00.000Z',
    )

    expect(extracted.categories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source_url: 'https://yolo66.x.yupoo.com/categories/943469?isSubCate=true',
          preview_image_status: 'discovered_only',
          preview_image_urls: ['https://photo.yupoo.com/yolo66/cover1/small.jpg'],
        }),
        expect.objectContaining({
          source_url: 'https://yolo66.x.yupoo.com/categories/5188236',
          preview_image_urls: [],
        }),
      ]),
    )
  })

  it('skips the junk uncategorized album bucket', async () => {
    scrapeState.pages.set(
      'https://west42.x.yupoo.com/categories',
      `
        <div class="categories__box-left">
          <a href="/categories/0" title="Uncategorized album">0</a>
          <a href="/categories/100" title="Bags">1</a>
        </div>
      `,
    )
    scrapeState.pages.set(
      'https://west42.x.yupoo.com/categories/100',
      '<div class="categories__box-left"><a href="/categories/100" title="Bags">1</a></div>',
    )

    const extracted = await scrapeYupooDiscovery('https://west42.x.yupoo.com/', 3, makeFetch())

    expect(scrapeState.processed).not.toContain('https://west42.x.yupoo.com/categories/0')
    expect(extracted.categories.every((category) => !category.source_url.endsWith('/categories/0'))).toBe(true)
  })

  it('follows index pagination links', async () => {
    scrapeState.pages.set(
      'https://tmf001.x.yupoo.com/categories',
      `
        <div class="categories__box-left">
          <a href="/categories/100" title="Bags">1</a>
        </div>
        <a href="/categories?page&#x3D;2">Next</a>
      `,
    )
    scrapeState.pages.set(
      'https://tmf001.x.yupoo.com/categories/100',
      '<div class="categories__box-left"><a href="/categories/100" title="Bags">1</a></div>',
    )
    scrapeState.pages.set(
      'https://tmf001.x.yupoo.com/categories?page=2',
      '<div class="categories__box-left"><a href="/categories/200" title="Shoes">2</a></div>',
    )
    scrapeState.pages.set(
      'https://tmf001.x.yupoo.com/categories/200',
      '<div class="categories__box-left"><a href="/categories/200" title="Shoes">2</a></div>',
    )

    const extracted = await scrapeYupooDiscovery('https://tmf001.x.yupoo.com/', 4, makeFetch())

    expect(scrapeState.processed).toContain('https://tmf001.x.yupoo.com/categories?page=2')
    expect(extracted.categories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source_url: 'https://tmf001.x.yupoo.com/categories/200' }),
      ]),
    )
  })

  it('preserves sidebar discovery order instead of alphabetical url order', async () => {
    scrapeState.pages.set(
      'https://west42.x.yupoo.com/categories',
      `
        <div class="categories__box-left">
          <a href="/categories/300" title="Featured">1</a>
          <a href="/categories/100" title="Bags">2</a>
          <a href="/categories/200" title="Shoes">3</a>
        </div>
      `,
    )
    for (const id of ['100', '200', '300']) {
      scrapeState.pages.set(
        `https://west42.x.yupoo.com/categories/${id}`,
        `<div class=\"categories__box-left\"><a href=\"/categories/${id}\" title=\"Cat ${id}\">1</a></div>`,
      )
    }

    await scrapeYupooDiscovery('https://west42.x.yupoo.com/', 3, makeFetch())

    expect(scrapeState.processed).toEqual([
      'https://west42.x.yupoo.com/categories',
      'https://west42.x.yupoo.com/categories/300',
      'https://west42.x.yupoo.com/categories/100',
    ])
  })

  it('merges query-bearing sidebar hrefs with their fetched page instead of duplicating', () => {
    const extracted = extractDiscoveryFromHtml(
      `
        <div class="categories__box-left">
          <a href="/categories/943469?isSubCate=true" title="Clothes Yupoo">2</a>
          <a href="/categories/943469?isSubCate=true&amp;navSource=custom" title="Clothes Yupoo">2</a>
        </div>
      `,
      'https://yolo66.x.yupoo.com/categories',
      '2026-04-27T00:00:00.000Z',
    )

    const matches = extracted.categories.filter((category) =>
      category.source_url.includes('/categories/943469'),
    )
    expect(matches).toHaveLength(1)
    expect(matches[0]?.source_url).toBe('https://yolo66.x.yupoo.com/categories/943469?isSubCate=true')
  })
})
