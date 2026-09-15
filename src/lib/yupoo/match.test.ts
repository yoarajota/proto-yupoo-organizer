import { describe, expect, it } from 'vitest'
import { extractIntentSignals } from './classification'
import { rankSuppliersForMission } from './match'

describe('rankSuppliersForMission', () => {
  it('ranks suppliers by intent overlap, confidence, and freshness', () => {
    const ranked = rankSuppliersForMission(
      'LV women leather bags',
      [
        {
          id: 'sup-1',
          supplier_key: 'bagshouse',
          category_refs: ['women', 'bags'],
          normalized_category_refs: ['lv', 'bags'],
          last_seen_at: '2026-04-22T00:00:00.000Z',
          confidence: 0.8,
        },
        {
          id: 'sup-2',
          supplier_key: 'shoecity',
          category_refs: ['lv', 'bags', 'women'],
          normalized_category_refs: [],
          last_seen_at: '2026-01-01T00:00:00.000Z',
          confidence: 0.9,
        },
      ],
      '2026-04-23T00:00:00.000Z',
    )

    expect(ranked).toHaveLength(2)
    expect(ranked[0].supplier_id).toBe('sup-1')
    expect(ranked[0].rank_score).toBeGreaterThan(ranked[1].rank_score)
    expect(ranked[0].rank_reasons.normalized_overlap).toBeGreaterThan(0)
    expect(ranked[1].rank_reasons.raw_keyword_overlap).toBeGreaterThan(0)
  })

  it('falls back to raw refs when normalized classification is absent', () => {
    const ranked = rankSuppliersForMission(
      'wallet',
      [
        {
          id: 'sup-1',
          supplier_key: 'walletpro',
          category_refs: ['wallet'],
          normalized_category_refs: [],
          last_seen_at: '2026-04-23T00:00:00.000Z',
          confidence: 0.8,
        },
      ],
      '2026-04-23T00:00:00.000Z',
    )

    expect(ranked[0].rank_reasons.raw_keyword_overlap).toBeGreaterThan(0)
  })

  it('lets normalized brand overlap decide when refs are present and stays neutral when absent', () => {
    const base = {
      supplier_key: 'shop',
      category_refs: [],
      last_seen_at: '2026-04-23T00:00:00.000Z',
      confidence: 0.8,
    }

    const withRefs = rankSuppliersForMission(
      'lv bags',
      [
        { ...base, id: 'brand-match', normalized_category_refs: ['lv'] },
        { ...base, id: 'product-match', normalized_category_refs: ['bags'] },
      ],
      '2026-04-23T00:00:00.000Z',
    )

    expect(withRefs[0].supplier_id).toBe('brand-match')
    expect(withRefs[0].rank_score).toBeGreaterThan(withRefs[1].rank_score)
    expect(withRefs[0].rank_reasons.normalized_brand_overlap).toBe(1)
    expect(withRefs[1].rank_reasons.normalized_brand_overlap).toBe(0)

    const withoutRefs = rankSuppliersForMission(
      'lv bags',
      [
        { ...base, id: 'brand-match', normalized_category_refs: [] },
        { ...base, id: 'product-match', normalized_category_refs: [] },
      ],
      '2026-04-23T00:00:00.000Z',
    )

    expect(withoutRefs[0].rank_score).toBe(withoutRefs[1].rank_score)
    expect(withoutRefs[0].rank_reasons.normalized_overlap).toBe(0)
    expect(withoutRefs[0].rank_reasons.normalized_brand_overlap).toBe(0)
  })

  it('clamps malformed confidence values', () => {
    const ranked = rankSuppliersForMission(
      'wallet',
      [
        {
          id: 'sup-1',
          supplier_key: 'walletpro',
          category_refs: ['wallet'],
          normalized_category_refs: [],
          last_seen_at: '2026-04-23T00:00:00.000Z',
          confidence: 9,
        },
      ],
      '2026-04-23T00:00:00.000Z',
    )

    expect(ranked[0].rank_reasons.supplier_confidence).toBe(1)
  })
})

describe('extractIntentSignals multi-word intents (Wave 2)', () => {
  it('resolves small leather goods to the wallets canonical', () => {
    const signals = extractIntentSignals('looking for small leather goods')

    expect(signals.product_signals).toContain('wallets')
  })

  it('resolves air jordan intents to the jordan brand', () => {
    const signals = extractIntentSignals('air jordan 1 retro')

    expect(signals.brand_signal).toBe('jordan')
  })

  it('strips price prefixes before matching multi-word intents', () => {
    const signals = extractIntentSignals('¥99 air jordan shoes')

    expect(signals.normalized_label).toBe('air jordan shoes')
    expect(signals.brand_signal).toBe('jordan')
    expect(signals.product_signals).toContain('shoes')
  })

  it('keeps unigram product matching working', () => {
    const signals = extractIntentSignals('bags')

    expect(signals.product_signals).toContain('bags')
  })

  it('collects every multi-word product canonical in one intent', () => {
    const signals = extractIntentSignals('small leather goods and crossbody bag', {
      canonical_products: [
        { canonical: 'crossbody', display: 'Crossbody', aliases: ['Crossbody'] },
      ],
    })

    expect(signals.product_signals).toEqual(expect.arrayContaining(['wallets', 'crossbody', 'bags']))
  })
})
