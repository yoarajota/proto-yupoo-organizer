import { describe, expect, it } from 'vitest'
import {
  classifyDiscoveredCategory,
  cleanupCategoryText,
  mineCandidateAliases,
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

describe('evasion-aware normalization (Wave 2)', () => {
  const stoneIslandContext = {
    canonical_brands: [
      {
        canonical: 'stone-island',
        display: 'Stone Island',
        aliases: ['stone island', 'SI', 'stoney', 'topstoney'],
        embeddingTerms: ['stone island'],
      },
    ],
  }

  it('sends full-mask runs to review instead of compacting them into a false brand', () => {
    const result = classifyDiscoveredCategory({
      raw_label: 'S****i****',
      category_path: ['categories', 'evasion'],
      source_url: 'https://shop.x.yupoo.com/categories/evasion',
      context: stoneIslandContext,
    })

    expect(result.brand_signal).toBeNull()
    expect(result.classification_status).toBe('needs_review')
  })

  it('tokenizes slash-joined fragments and resolves transliteration aliases from entries', () => {
    expect(cleanupCategoryText('Thorium/Maicai/Down Jacket')).toBe('thorium maicai down jacket')

    const result = classifyDiscoveredCategory({
      raw_label: 'Thorium/Maicai/Down Jacket',
      category_path: ['categories', 'arcteryx'],
      source_url: 'https://shop.x.yupoo.com/categories/arcteryx',
      context: {
        canonical_brands: [
          {
            canonical: 'arcteryx',
            display: "Arc'teryx",
            aliases: ['Maicai', 'Thorium'],
            embeddingTerms: ["Arc'teryx"],
          },
        ],
      },
    })

    expect(result.brand_signal).toBe('arcteryx')
  })

  it('resolves AJ1 through alias entries', () => {
    const result = classifyDiscoveredCategory({
      raw_label: 'AJ1',
      category_path: ['categories', 'jordan'],
      source_url: 'https://shop.x.yupoo.com/categories/jordan',
    })

    expect(result.brand_signal).toBe('jordan')
    expect(result.classification_method).toBe('rules')
  })

  it('strips price and promo prefixes before matching', () => {
    expect(cleanupCategoryText('¥99 Air Jordan 1')).toBe('air jordan')
    expect(cleanupCategoryText('🔥Special Sale Nike Shoes')).toBe('nike shoes')

    const priced = classifyDiscoveredCategory({
      raw_label: '¥99 Air Jordan 1',
      category_path: ['categories', 'jordan'],
      source_url: 'https://shop.x.yupoo.com/categories/jordan',
    })
    expect(priced.brand_signal).toBe('jordan')

    const promo = classifyDiscoveredCategory({
      raw_label: '🔥Special Sale Nike Shoes',
      category_path: ['categories', 'nike'],
      source_url: 'https://shop.x.yupoo.com/categories/nike',
    })
    expect(promo.normalized_label).toBe('nike shoes')
    expect(promo.brand_signal).toBe('nike')
    expect(promo.product_signal).toBe('shoes')
  })

  it('never lets embeddings decide alone on short cleaned signals', () => {
    const result = classifyDiscoveredCategory({
      raw_label: 'Ap',
      category_path: ['categories', 'short'],
      source_url: 'https://shop.x.yupoo.com/categories/short',
      context: {
        embedding_brand_match: {
          entity_type: 'brand',
          entity_id: 'brand-1',
          canonical_slug: 'lv',
          canonical_name: 'LV',
          source_text: 'Louis Vuitton',
          similarity: 0.9,
          threshold: 0.7,
        },
      },
    })

    expect(result.brand_signal).toBeNull()
    expect(result.classification_status).toBe('needs_review')
  })
})

describe('short-alias precision (US-001)', () => {
  const catalogLikeBrands = [
    { canonical: 'lv', display: 'LV', aliases: ['lv', 'l v'], embeddingTerms: ['louis vuitton'] },
    { canonical: 'on-running', display: 'On Running', aliases: ['On', 'on running', 'on-running'], embeddingTerms: ['On Running'] },
    { canonical: 'nike', display: 'Nike', aliases: ['nike', 'nk', 'n i k e', 'swoosh', 'N*KE'], embeddingTerms: ['Nike'] },
    { canonical: 'palm-angels', display: 'Palm Angels', aliases: ['PA', 'palm angels', 'palm-angels'], embeddingTerms: ['Palm Angels'] },
    { canonical: 'timberland', display: 'Timberland', aliases: ['timberland', 'tb', '6 inch boots'], embeddingTerms: ['Timberland'] },
    { canonical: 'chrome-hearts', display: 'Chrome Hearts', aliases: ['CH', 'Chrome-Hearts', 'chromehearts', 'chrome hearts', 'CH*OME'], embeddingTerms: ['Chrome Hearts'] },
    { canonical: 'acne-studios', display: 'Acne Studios', aliases: ['Acne', 'AC*N*E', 'acne studios', 'acne-studios'], embeddingTerms: ['Acne Studios'] },
    { canonical: 'louis-vuitton', display: 'Louis Vuitton', aliases: ['Louis Vuitton', 'LV', 'L V', 'Louv', 'LVuitton', 'louis-vuitton', 'louisvuitton'], embeddingTerms: ['Louis Vuitton'] },
    { canonical: 'carhartt-wip', display: 'Carhartt WIP', aliases: ['Carhartt', 'Ca*har*t', 'carhartt wip', 'carhartt-wip'], embeddingTerms: ['Carhartt WIP'] },
  ]

  function brandOf(raw_label: string) {
    return classifyDiscoveredCategory({
      raw_label,
      category_path: ['fixtures'],
      source_url: 'https://fixture.invalid/',
      context: { canonical_brands: catalogLikeBrands },
    }).brand_signal
  }

  it('never substring-matches len-2 aliases inside longer tokens', () => {
    expect(brandOf('C*** C*OM*PANY')).toBeNull()
    expect(brandOf('Mon*t-B*ell')).toBeNull()
  })

  it('keeps genuine short evasions via explicit harvested aliases', () => {
    expect(brandOf('N*KE')).toBe('nike')
    expect(brandOf('CH*OME HE*RTS')).toBe('chrome-hearts')
  })

  it('keeps standalone short tokens resolving', () => {
    expect(brandOf('L*V SHOES')).toBe('lv')
    expect(brandOf('ON RU*NING')).toBe('on-running')
  })

  it('keeps the must-keep resolutions', () => {
    expect(brandOf('Louis Vuitton /LV')).toBe('louis-vuitton')
    expect(brandOf('AC*N*E/Ca*har*t WIP')).toBe('carhartt-wip')
    expect(brandOf('S****i****')).toBeNull()
  })
})

describe('mineCandidateAliases (Wave 2)', () => {
  const brandEntries = [
    { canonical: 'acne', display: 'Acne Studios', aliases: ['Acne'], embeddingTerms: ['Acne'] },
    { canonical: 'carhartt', display: 'Carhartt', aliases: ['Carhartt'], embeddingTerms: ['Carhartt'] },
    {
      canonical: 'air-jordan',
      display: 'Air Jordan',
      aliases: ['AJ', 'Jordan', 'air-jordan'],
      embeddingTerms: ['Air Jordan'],
    },
    { canonical: 'burberry', display: 'Burberry', aliases: ['Burberry'], embeddingTerms: ['Burberry'] },
    { canonical: 'prada', display: 'Prada', aliases: ['Prada'], embeddingTerms: ['Prada'] },
  ]

  it('proposes canonicals for live-observed evasion variants from review consensus', () => {
    const candidates = mineCandidateAliases(
      ['AC*N*E', 'AC*N*E', 'Ca*har*t', 'Jrdn', 'burserry', 'PDA', 'unreviewed label'],
      [
        { raw_label: 'AC*N*E', decision: 'accept', brand_signal: 'acne' },
        { raw_label: 'Ca*har*t', decision: 'accept', brand_signal: 'carhartt' },
        { raw_label: 'Jrdn', decision: 'edit', brand_signal: 'air-jordan' },
        { raw_label: 'burserry', decision: 'accept', brand_signal: 'burberry' },
        { raw_label: 'PDA', decision: 'accept', brand_signal: 'prada' },
      ],
      brandEntries,
    )

    expect(candidates).toHaveLength(5)
    expect(new Map(candidates.map((candidate) => [candidate.variant, candidate.canonical]))).toEqual(
      new Map([
        ['AC*N*E', 'acne'],
        ['Ca*har*t', 'carhartt'],
        ['Jrdn', 'air-jordan'],
        ['burserry', 'burberry'],
        ['PDA', 'prada'],
      ]),
    )
    expect(candidates[0].variant).toBe('AC*N*E')
    expect(candidates[0].evidence).toMatchObject({
      observations: 2,
      approvals: 1,
      rejections: 0,
      source: 'review_consensus',
    })
  })

  it('excludes variants rejected more often than approved and labels without decisions', () => {
    const candidates = mineCandidateAliases(
      ['contested', 'unreviewed label'],
      [
        { raw_label: 'contested', decision: 'accept', brand_signal: 'prada' },
        { raw_label: 'contested', decision: 'reject', brand_signal: null },
        { raw_label: 'contested', decision: 'reject', brand_signal: null },
      ],
      brandEntries,
    )

    expect(candidates).toEqual([])
  })

  it('skips variants that already match a curated alias exactly', () => {
    const candidates = mineCandidateAliases(
      ['Jordan'],
      [{ raw_label: 'Jordan', decision: 'accept', brand_signal: 'air-jordan' }],
      brandEntries,
    )

    expect(candidates).toEqual([])
  })
})
