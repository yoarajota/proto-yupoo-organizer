import { describe, expect, it } from 'vitest'
import { groupMissionCategoryReviewItems } from './mission-category-review'

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
