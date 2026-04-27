import { describe, expect, it } from 'vitest'
import { extractDiscoveryFromHtml } from './scout'

describe('extractDiscoveryFromHtml', () => {
  it('extracts category labels from the Yupoo categories sidebar and normalizes obfuscated refs', () => {
    const html = `
      <div class="categories__box-left">
        <a href="/categories/987">B4G$</a>
        <a href="/categories/123">L V Shoes</a>
      </div>
      <a href="https://example.com/nope">Non-yupoo</a>
    `

    const extracted = extractDiscoveryFromHtml(html, 'https://abcstore.x.yupoo.com/categories', '2026-04-23T00:00:00.000Z')

    expect(extracted.categories.length).toBe(2)
    expect(extracted.categories[0]?.source_url).toContain('/categories/')
    expect(extracted.categories[0]?.raw_label).toBe('B4G$')
    expect(extracted.suppliers).toHaveLength(1)
    expect(extracted.suppliers[0]?.supplier_key).toBe('abcstore.x')
    expect(extracted.suppliers[0]?.normalized_category_refs).toEqual([])
    expect(extracted.suppliers[0]?.category_refs).toEqual(
      expect.arrayContaining(['bags', 'lv', 'shoes']),
    )
  })

  it('deduplicates repeated category urls and merges normalized refs', () => {
    const html = `
      <div class="categories__box-left">
        <a href="https://bagsshop.x.yupoo.com/categories/111">Bags</a>
        <a href="https://bagsshop.x.yupoo.com/categories/111">B4G$</a>
      </div>
    `

    const extracted = extractDiscoveryFromHtml(html, 'https://bagsshop.x.yupoo.com/categories', '2026-04-23T00:00:00.000Z')

    expect(extracted.categories).toHaveLength(1)
    expect(extracted.suppliers).toHaveLength(1)
    expect(extracted.suppliers[0]?.category_refs.filter((ref) => ref === 'bags')).toHaveLength(1)
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
})
