import { describe, expect, it } from 'vitest'
import { RollupCategoryStrategySchema } from './schemas/sourcing-classification.ts'
import {
  attachSuggestedReviewAliases,
  groupMissionCategoryReviewItems,
  rollupCategoryStrategy,
} from './mission-category-review'

describe('groupMissionCategoryReviewItems', () => {
  it('merges and deduplicates preview images in stable order', () => {
    const grouped = groupMissionCategoryReviewItems([
      {
        mission_id: 'mission-1',
        source_category_id: 'cat-1',
        display_label: 'LV Bags',
        canonical_brand: 'lv',
        canonical_product_type: 'bags',
        classification_confidence: 0.7,
        classification_method: 'embedding',
        classification_status: 'needs_review',
        evidence: { raw_label: 'Loui Vuiton B4G$', normalized_label: 'lv bags' },
        source_category: {
          preview_image_urls: [
            'https://cdn.example.com/1.jpg',
            'https://cdn.example.com/2.jpg',
          ],
          source_url: null,
        },
      },
      {
        mission_id: 'mission-1',
        source_category_id: 'cat-2',
        display_label: 'LV Bags',
        canonical_brand: 'lv',
        canonical_product_type: 'bags',
        classification_confidence: 0.72,
        classification_method: 'embedding',
        classification_status: 'needs_review',
        evidence: { raw_label: 'L V Bags', normalized_label: 'lv bags' },
        source_category: {
          preview_image_urls: [
            'https://cdn.example.com/2.jpg',
            'https://cdn.example.com/3.jpg',
            'https://cdn.example.com/4.jpg',
            'https://cdn.example.com/5.jpg',
          ],
          source_url: null,
        },
      },
    ])

    expect(grouped['mission-1']).toHaveLength(1)
    expect(grouped['mission-1']?.[0]?.preview_image_urls).toEqual([
      'https://cdn.example.com/1.jpg',
      'https://cdn.example.com/2.jpg',
      'https://cdn.example.com/3.jpg',
      'https://cdn.example.com/4.jpg',
    ])
  })
})

describe('rollupCategoryStrategy', () => {
  it('merges the same logical category across two missions and shops', () => {
    const groups = rollupCategoryStrategy([
      {
        mission_id: 'mission-a',
        source_category_id: 'cat-a1',
        source_url: 'https://west42.x.yupoo.com/categories/1',
        raw_label: 'Thorium/Maicai/Down Jacket',
        normalized_label: 'thorium maicai down jacket',
        canonical_brand: 'arc-teryx',
        canonical_product_type: 'jackets',
        display_label: "Arc'teryx Jackets",
        classification_status: 'auto_accepted',
        classification_confidence: 0.92,
      },
      {
        mission_id: 'mission-b',
        source_category_id: 'cat-b1',
        source_url: 'https://pearlmarket.x.yupoo.com/categories/7',
        raw_label: 'Beta AR',
        normalized_label: 'beta ar',
        canonical_brand: 'arc-teryx',
        canonical_product_type: 'jackets',
        display_label: "Arc'teryx Jackets",
        classification_status: 'needs_review',
        classification_confidence: 0.68,
      },
      {
        mission_id: 'mission-a',
        source_category_id: 'cat-a2',
        source_url: 'https://west42.x.yupoo.com/categories/2',
        raw_label: 'PRA*DA*',
        normalized_label: 'prada',
        canonical_brand: 'prada',
        canonical_product_type: null,
        display_label: 'Prada',
        classification_status: 'needs_review',
        classification_confidence: 0.99,
      },
    ])

    expect(groups).toHaveLength(2)
    const [merged] = groups.filter((group) => group.canonical_brand === 'arc-teryx')
    expect(merged?.member_count).toBe(2)
    expect(merged?.mission_ids).toEqual(['mission-a', 'mission-b'])
    expect(merged?.shop_origins).toEqual([
      'https://pearlmarket.x.yupoo.com',
      'https://west42.x.yupoo.com',
    ])
    expect(merged?.raw_variants).toEqual(['Beta AR', 'Thorium/Maicai/Down Jacket'])
    expect(merged?.status_counts).toEqual({ auto_accepted: 1, needs_review: 1 })
  })

  it('prioritizes cross-shop corroboration over single-shop confidence', () => {
    const groups = rollupCategoryStrategy([
      {
        mission_id: 'mission-a',
        source_category_id: 'cat-a1',
        source_url: 'https://solo.x.yupoo.com/categories/1',
        raw_label: 'PRA*DA*',
        normalized_label: 'prada',
        canonical_brand: 'prada',
        canonical_product_type: null,
        display_label: 'Prada',
        classification_status: 'needs_review',
        classification_confidence: 0.99,
      },
      {
        mission_id: 'mission-a',
        source_category_id: 'cat-a2',
        source_url: 'https://west42.x.yupoo.com/categories/1',
        raw_label: 'Ca*har*t WIP',
        normalized_label: 'carhartt wip',
        canonical_brand: 'carhartt-wip',
        canonical_product_type: null,
        display_label: 'Carhartt WIP',
        classification_status: 'needs_review',
        classification_confidence: 0.7,
      },
      {
        mission_id: 'mission-b',
        source_category_id: 'cat-b1',
        source_url: 'https://pearlmarket.x.yupoo.com/categories/3',
        raw_label: 'Carhartt',
        normalized_label: 'carhartt',
        canonical_brand: 'carhartt-wip',
        canonical_product_type: null,
        display_label: 'Carhartt WIP',
        classification_status: 'needs_review',
        classification_confidence: 0.71,
      },
    ])

    expect(groups.map((group) => group.canonical_brand)).toEqual(['carhartt-wip', 'prada'])
    expect(groups[0]?.priority_rank).toBe(1)
    expect(groups[1]?.priority_rank).toBe(2)
    expect(groups[0]?.priority_score).toBeGreaterThan(groups[1]?.priority_score ?? 0)
  })
})

describe('attachSuggestedReviewAliases', () => {
  it('gives every batched product-only and brand-only item a suggested alias', () => {
    const grouped = groupMissionCategoryReviewItems([
      {
        mission_id: 'mission-1',
        source_category_id: 'cat-1',
        display_label: 'pouches',
        canonical_brand: null,
        canonical_product_type: 'pouches',
        classification_confidence: 0.6,
        classification_method: 'rules',
        classification_status: 'needs_review',
        evidence: { raw_label: 'PDA pouches', normalized_label: 'pda pouches', decision_reason: 'product_only_needs_confirmation' },
        source_category: { preview_image_urls: [], source_url: 'https://shop.x.yupoo.com/categories/1' },
      },
      {
        mission_id: 'mission-1',
        source_category_id: 'cat-2',
        display_label: 'Prada',
        canonical_brand: 'prada',
        canonical_product_type: null,
        classification_confidence: 0.65,
        classification_method: 'rules',
        classification_status: 'needs_review',
        evidence: { raw_label: 'PRA*DA*', normalized_label: 'prada', decision_reason: 'brand_only_needs_confirmation' },
        source_category: { preview_image_urls: [], source_url: 'https://shop.x.yupoo.com/categories/2' },
      },
    ])
    const batches = grouped['mission-1'] ?? []
    expect(batches).toHaveLength(2)

    const assisted = attachSuggestedReviewAliases(batches, [
      { raw_label: 'PDA pouches', decision: 'accept', brand_signal: 'prada' },
    ])

    expect(assisted).toHaveLength(2)
    assisted.forEach((item) => {
      expect(item.suggested_alias).not.toBeNull()
    })
    expect(assisted.find((item) => item.brand_signal === null)?.suggested_alias).toMatchObject({
      variant: 'PDA pouches',
      canonical: 'prada',
    })
    expect(assisted.find((item) => item.brand_signal === 'prada')?.suggested_alias).toMatchObject({
      variant: 'PRA*DA*',
      canonical: 'prada',
    })
  })

  it('withholds suggestions for already-curated alias forms', () => {
    const grouped = groupMissionCategoryReviewItems([
      {
        mission_id: 'mission-1',
        source_category_id: 'cat-1',
        display_label: 'Prada',
        canonical_brand: 'prada',
        canonical_product_type: null,
        classification_confidence: 0.65,
        classification_method: 'rules',
        classification_status: 'needs_review',
        evidence: { raw_label: 'Prada', normalized_label: 'prada', decision_reason: 'brand_only_needs_confirmation' },
        source_category: { preview_image_urls: [], source_url: 'https://shop.x.yupoo.com/categories/1' },
      },
    ])
    const assisted = attachSuggestedReviewAliases(grouped['mission-1'] ?? [], [], ['Prada', 'prada'])
    expect(assisted[0]?.suggested_alias).toBeNull()
  })
})

describe('RollupCategoryStrategySchema', () => {
  it('accepts a mission rollup request', () => {
    expect(
      RollupCategoryStrategySchema.safeParse({ mission_id: '550e8400-e29b-41d4-a716-446655440000' }).success,
    ).toBe(true)
  })

  it('rejects malformed strategy input', () => {
    expect(RollupCategoryStrategySchema.safeParse({}).success).toBe(false)
    expect(RollupCategoryStrategySchema.safeParse({ mission_id: 'not-a-uuid' }).success).toBe(false)
    expect(
      RollupCategoryStrategySchema.safeParse({
        mission_id: '550e8400-e29b-41d4-a716-446655440000',
        mission_ids: ['not-a-uuid'],
      }).success,
    ).toBe(false)
  })
})
