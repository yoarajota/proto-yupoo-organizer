import { describe, expect, it } from 'vitest'
import {
  classifyDiscoveredCategory,
  cleanupCategoryText,
} from './classification'

describe('cleanupCategoryText', () => {
  it('normalizes leetspeak product labels', () => {
    expect(cleanupCategoryText('B4G$')).toBe('bags')
  })

  it('compacts split brand initials', () => {
    expect(cleanupCategoryText('L V')).toBe('lv')
  })

  it('cleans separator-heavy unicode-obfuscated labels', () => {
    expect(cleanupCategoryText('L__V / BÁG$')).toBe('lv bags')
  })
})

describe('classifyDiscoveredCategory', () => {
  it('returns rules for exact alias hits', () => {
    const result = classifyDiscoveredCategory({
      raw_label: 'L V Bags',
      category_path: ['categories', '1'],
      source_url: 'https://shop.x.yupoo.com/categories/1',
    })

    expect(result.classification_method).toBe('rules')
    expect(result.brand_signal).toBe('lv')
    expect(result.product_signal).toBe('bags')
    expect(result.classification_status).toBe('auto_accepted')
  })

  it('matches runtime brand aliases from the catalog', () => {
    const result = classifyDiscoveredCategory({
      raw_label: 'PRA*DA* Bags',
      category_path: ['categories', 'prada'],
      source_url: 'https://shop.x.yupoo.com/categories/prada',
      context: {
        canonical_brands: [
          {
            canonical: 'prada',
            display: 'Prada',
            aliases: ['PRA*DA*'],
            embeddingTerms: ['Prada', 'PRA*DA*'],
          },
        ],
      },
    })

    expect(result.classification_method).toBe('rules')
    expect(result.brand_signal).toBe('prada')
    expect(result.product_signal).toBe('bags')
  })

  it('matches runtime product types from the catalog', () => {
    const result = classifyDiscoveredCategory({
      raw_label: 'Prada Crossbody',
      category_path: ['categories', 'crossbody'],
      source_url: 'https://shop.x.yupoo.com/categories/crossbody',
      context: {
        canonical_brands: [
          {
            canonical: 'prada',
            display: 'Prada',
            aliases: ['Prada'],
            embeddingTerms: ['Prada'],
          },
        ],
        canonical_products: [
          {
            canonical: 'crossbody',
            display: 'Crossbody',
            aliases: ['Crossbody'],
          },
        ],
      },
    })

    expect(result.classification_method).toBe('rules')
    expect(result.brand_signal).toBe('prada')
    expect(result.product_signal).toBe('crossbody')
    expect(result.display_label).toBe('Prada Crossbody')
  })

  it('falls through to embedding similarity for unresolved labels', () => {
    const result = classifyDiscoveredCategory({
      raw_label: 'Loui Vuiton Bags',
      category_path: ['categories', '2'],
      source_url: 'https://shop.x.yupoo.com/categories/2',
      context: {
        embedding_brand_match: {
          entity_type: 'brand',
          entity_id: 'brand-1',
          canonical_slug: 'lv',
          canonical_name: 'LV',
          source_text: 'Louis Vuitton',
          similarity: 0.91,
          threshold: 0.7,
        },
      },
    })

    expect(result.classification_method).toBe('embedding')
    expect(result.brand_signal).toBe('lv')
    expect(result.evidence.embedding_source_id).toBe('brand-1')
  })

  it('flags ambiguous labels for review', () => {
    const result = classifyDiscoveredCategory({
      raw_label: 'designer bags',
      category_path: ['categories', '3'],
      source_url: 'https://shop.x.yupoo.com/categories/3',
    })

    expect(result.classification_status).toBe('needs_review')
    expect(result.product_signal).toBe('bags')
  })

  it('auto-accepts repeated exact product-only labels within the same shop context', () => {
    const result = classifyDiscoveredCategory({
      raw_label: 'bags',
      category_path: ['categories', '4'],
      source_url: 'https://shop.x.yupoo.com/categories/4',
      context: {
        repeated_within_shop_label_count: 2,
      },
    })

    expect(result.classification_status).toBe('auto_accepted')
    expect(result.product_signal).toBe('bags')
    expect(result.evidence.decision_reason).toBe('repeated_exact_product_only')
  })

  it('keeps embedding-only brand guesses without product support in review', () => {
    const result = classifyDiscoveredCategory({
      raw_label: 'Loui Vuiton',
      category_path: ['categories', '5'],
      source_url: 'https://shop.x.yupoo.com/categories/5',
      context: {
        embedding_brand_match: {
          entity_type: 'brand_alias',
          entity_id: 'alias-1',
          canonical_slug: 'lv',
          canonical_name: 'LV',
          source_text: 'Loui Vuiton',
          similarity: 0.82,
          threshold: 0.7,
        },
      },
    })

    expect(result.classification_method).toBe('embedding')
    expect(result.brand_signal).toBe('lv')
    expect(result.product_signal).toBeNull()
    expect(result.classification_status).toBe('needs_review')
    expect(result.evidence.decision_reason).toBe('embedding_brand_without_product')
  })

  it('auto-accepts repeated brand-plus-product consensus below the strict threshold', () => {
    const result = classifyDiscoveredCategory({
      raw_label: 'Shop Loui Vuiton Bags',
      category_path: ['categories', '6'],
      source_url: 'https://shop.x.yupoo.com/categories/6',
      context: {
        repeated_signal_pair_count: 2,
        embedding_brand_match: {
          entity_type: 'brand',
          entity_id: 'brand-1',
          canonical_slug: 'lv',
          canonical_name: 'LV',
          source_text: 'Louis Vuitton',
          similarity: 0.79,
          threshold: 0.7,
        },
      },
    })

    expect(result.classification_status).toBe('auto_accepted')
    expect(result.evidence.decision_reason).toBe('repeated_brand_product_consensus')
  })

  it('keeps exact alias matches ahead of conflicting vector matches', () => {
    const result = classifyDiscoveredCategory({
      raw_label: 'L V Bags',
      category_path: ['categories', '7'],
      source_url: 'https://shop.x.yupoo.com/categories/7',
      context: {
        embedding_brand_match: {
          entity_type: 'brand',
          entity_id: 'brand-2',
          canonical_slug: 'prada',
          canonical_name: 'Prada',
          source_text: 'Prada',
          similarity: 0.99,
          threshold: 0.7,
        },
      },
    })

    expect(result.classification_method).toBe('rules')
    expect(result.brand_signal).toBe('lv')
    expect(result.evidence.embedding_source_id).toBeNull()
  })

  it('uses vector product matches above threshold', () => {
    const result = classifyDiscoveredCategory({
      raw_label: 'Prada Cross Body',
      category_path: ['categories', '8'],
      source_url: 'https://shop.x.yupoo.com/categories/8',
      context: {
        canonical_brands: [
          {
            canonical: 'prada',
            display: 'Prada',
            aliases: ['Prada'],
            embeddingTerms: ['Prada'],
          },
        ],
        embedding_product_match: {
          entity_type: 'product_type',
          entity_id: 'product-1',
          canonical_slug: 'crossbody',
          canonical_name: 'Crossbody',
          source_text: 'Crossbody',
          similarity: 0.88,
          threshold: 0.76,
        },
      },
    })

    expect(result.classification_method).toBe('embedding')
    expect(result.brand_signal).toBe('prada')
    expect(result.product_signal).toBe('crossbody')
  })
})
