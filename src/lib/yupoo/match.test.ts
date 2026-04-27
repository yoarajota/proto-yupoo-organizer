import { describe, expect, it } from 'vitest'
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
