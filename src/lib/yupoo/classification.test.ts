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

  it('falls through to embedding similarity for unresolved labels', () => {
    const result = classifyDiscoveredCategory({
      raw_label: 'Loui Vuiton Bags',
      category_path: ['categories', '2'],
      source_url: 'https://shop.x.yupoo.com/categories/2',
    })

    expect(result.classification_method).toBe('embedding')
    expect(result.brand_signal).toBe('lv')
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
      },
    })

    expect(result.classification_status).toBe('auto_accepted')
    expect(result.evidence.decision_reason).toBe('repeated_brand_product_consensus')
  })
})
