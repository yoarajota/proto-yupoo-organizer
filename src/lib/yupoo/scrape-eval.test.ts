import { describe, expect, it } from 'vitest'
import { classifyDiscoveredCategory } from './classification.ts'
import {
  analyzeYupooScrapeSummaries,
  compareYupooScrapeEvalReports,
  FROZEN_EVASION_FIXTURES,
  parseYupooShopEvalInput,
  summarizeEvasionFixtureSet,
  summarizeYupooShopRun,
} from './scrape-eval.ts'
import type { YupooDiscoveryResult } from './scout.ts'

const fetchedAt = '2026-05-09T00:00:00.000Z'

function makeResult(overrides: Partial<YupooDiscoveryResult> = {}): YupooDiscoveryResult {
  return {
    categories: [
      {
        source_url: 'https://west42.x.yupoo.com/categories/111',
        category_path: ['categories', '111'],
        raw_label: 'Scarves',
        preview_image_urls: ['https://west42.x.yupoo.com/scarves.jpg'],
        preview_image_status: 'fetched',
        extracted_at: fetchedAt,
        confidence: 0.9,
      },
    ],
    suppliers: [
      {
        supplier_key: 'west42.x',
        source_url: 'https://west42.x.yupoo.com',
        category_refs: ['scarves'],
        normalized_category_refs: [],
        last_seen_at: fetchedAt,
        confidence: 0.75,
      },
    ],
    pages: [
      {
        url: 'https://west42.x.yupoo.com/categories',
        status: 'fetched',
        http_status: 200,
        content_hash: 'a'.repeat(64),
        fetched_at: fetchedAt,
        discovered_urls: ['https://west42.x.yupoo.com/categories/111'],
        categories_count: 1,
        suppliers_count: 1,
        error: null,
        preview_debug: {
          page_is_concrete_category: false,
          extracted_preview_urls: [],
          matched_candidates: [],
        },
      },
    ],
    ...overrides,
  }
}

describe('parseYupooShopEvalInput', () => {
  it('validates and normalizes Yupoo benchmark input', () => {
    const parsed = parseYupooShopEvalInput({
      max_requests: 4,
      shops: [
        {
          url: 'https://west42.x.yupoo.com',
          expectations: {
            min_categories: 1,
            expected_labels: ['Scarves'],
            require_preview_images: true,
          },
        },
      ],
    })

    expect(parsed.shops[0]).toMatchObject({
      id: 'west42.x.yupoo.com',
      url: 'https://west42.x.yupoo.com/',
      expectations: {
        min_categories: 1,
        expected_labels: ['Scarves'],
        require_preview_images: true,
      },
    })
  })

  it('rejects non-Yupoo URLs', () => {
    expect(() =>
      parseYupooShopEvalInput({
        shops: [{ url: 'https://example.com' }],
      }),
    ).toThrow('must be a yupoo.com URL')
  })
})

describe('summarizeYupooShopRun', () => {
  it('marks a scrape as passing when expectations are met', () => {
    const summary = summarizeYupooShopRun({
      shop: {
        id: 'west42',
        url: 'https://west42.x.yupoo.com/',
        expectations: {
          min_categories: 1,
          expected_labels: ['scar'],
          min_preview_image_categories: 1,
        },
      },
      result: makeResult(),
      artifactPath: 'artifact.json',
      durationMs: 12,
    })

    expect(summary.ok).toBe(true)
    expect(summary.failure_codes).toEqual([])
    expect(summary.preview_image_count).toBe(1)
  })

  it('classifies zero categories, fetch failures, and missing preview coverage', () => {
    const summary = summarizeYupooShopRun({
      shop: {
        id: 'blocked-shop',
        url: 'https://blocked.x.yupoo.com/',
        expectations: {
          min_categories: 1,
          require_preview_images: true,
        },
      },
      result: makeResult({
        categories: [],
        pages: [
          {
            url: 'https://blocked.x.yupoo.com/categories',
            status: 'failed',
            http_status: null,
            content_hash: null,
            fetched_at: fetchedAt,
            discovered_urls: [],
            categories_count: 0,
            suppliers_count: 0,
            error: 'HTTP 525',
            preview_debug: null,
          },
        ],
      }),
      artifactPath: 'blocked.json',
      durationMs: 20,
    })

    expect(summary.ok).toBe(false)
    expect(summary.failure_codes).toEqual(
      expect.arrayContaining([
        'below_min_categories',
        'missing_required_preview_images',
        'page_fetch_failures',
        'zero_categories',
      ]),
    )
    expect(summary.page_failures[0]).toMatchObject({ error: 'HTTP 525' })
  })

  it('keeps partial page fetch failures diagnostic when category expectations are met', () => {
    const summary = summarizeYupooShopRun({
      shop: {
        id: 'partial-fetch',
        url: 'https://partial-fetch.x.yupoo.com/',
        expectations: {
          min_categories: 1,
        },
      },
      result: makeResult({
        pages: [
          ...makeResult().pages,
          {
            url: 'https://partial-fetch.x.yupoo.com/categories/404',
            status: 'failed',
            http_status: null,
            content_hash: null,
            fetched_at: fetchedAt,
            discovered_urls: [],
            categories_count: 0,
            suppliers_count: 0,
            error: 'HTTP 404',
            preview_debug: null,
          },
        ],
      }),
      artifactPath: 'partial-fetch.json',
      durationMs: 20,
    })

    expect(summary.ok).toBe(true)
    expect(summary.failure_codes).toEqual([])
    expect(summary.page_failures).toEqual([
      {
        url: 'https://partial-fetch.x.yupoo.com/categories/404',
        error: 'HTTP 404',
        http_status: null,
      },
    ])
  })

  it('records fetched category pages that have no preview images', () => {
    const summary = summarizeYupooShopRun({
      shop: { id: 'partial', url: 'https://partial.x.yupoo.com/' },
      result: makeResult({
        categories: [
          {
            source_url: 'https://partial.x.yupoo.com/categories/111',
            category_path: ['categories', '111'],
            raw_label: 'Shoes',
            preview_image_urls: [],
            preview_image_status: 'fetched',
            extracted_at: fetchedAt,
            confidence: 0.9,
          },
        ],
      }),
      artifactPath: 'partial.json',
      durationMs: 18,
    })

    expect(summary.missing_preview_categories).toEqual([
      {
        source_url: 'https://partial.x.yupoo.com/categories/111',
        raw_label: 'Shoes',
      },
    ])
  })

  it('classifies thrown scraper errors as scrape exceptions', () => {
    const summary = summarizeYupooShopRun({
      shop: { id: 'throws', url: 'https://throws.x.yupoo.com/' },
      result: null,
      artifactPath: 'throws.json',
      durationMs: 5,
      error: new Error('parser exploded'),
    })

    expect(summary.ok).toBe(false)
    expect(summary.failure_codes).toEqual(['scrape_exception', 'zero_categories'])
    expect(summary.error).toBe('parser exploded')
  })
})

describe('analyzeYupooScrapeSummaries', () => {
  it('groups failures into a Codex-readable report', () => {
    const passed = summarizeYupooShopRun({
      shop: { id: 'passed', url: 'https://passed.x.yupoo.com/' },
      result: makeResult(),
      artifactPath: 'passed.json',
      durationMs: 12,
    })
    const failed = summarizeYupooShopRun({
      shop: { id: 'failed', url: 'https://failed.x.yupoo.com/' },
      result: makeResult({ categories: [] }),
      artifactPath: 'failed.json',
      durationMs: 12,
    })
    const report = analyzeYupooScrapeSummaries('runs/1', [passed, failed])

    expect(report.total_shops).toBe(2)
    expect(report.failed_shops).toBe(1)
    expect(report.common_failure_clusters).toEqual([
      { code: 'zero_categories', count: 1, shop_ids: ['failed'] },
    ])
    expect(report.candidate_fixtures[0]).toMatchObject({
      shop_id: 'passed',
      content_hash: 'a'.repeat(64),
    })
  })
})

describe('compareYupooScrapeEvalReports', () => {
  it('accepts an iteration when tests pass, a failing shop improves, and passing shops do not regress', () => {
    const previousPassing = summarizeYupooShopRun({
      shop: { id: 'passed', url: 'https://passed.x.yupoo.com/' },
      result: makeResult(),
      artifactPath: 'passed.json',
      durationMs: 12,
    })
    const previousFailing = summarizeYupooShopRun({
      shop: { id: 'failed', url: 'https://failed.x.yupoo.com/' },
      result: makeResult({ categories: [] }),
      artifactPath: 'failed.json',
      durationMs: 12,
    })
    const currentPassing = summarizeYupooShopRun({
      shop: { id: 'passed', url: 'https://passed.x.yupoo.com/' },
      result: makeResult(),
      artifactPath: 'passed-current.json',
      durationMs: 12,
    })
    const currentImproved = summarizeYupooShopRun({
      shop: { id: 'failed', url: 'https://failed.x.yupoo.com/' },
      result: makeResult(),
      artifactPath: 'failed-current.json',
      durationMs: 12,
    })
    const previous = analyzeYupooScrapeSummaries('runs/previous', [previousPassing, previousFailing])
    const current = analyzeYupooScrapeSummaries('runs/current', [currentPassing, currentImproved])

    const comparison = compareYupooScrapeEvalReports({ previous, current, unitTestsPassed: true })

    expect(comparison.acceptance).toEqual({
      unit_tests_passed: true,
      no_previously_passing_regressions: true,
      at_least_one_failure_cluster_improved: true,
      accepted: true,
    })
    expect(comparison.improved_failure_clusters).toEqual([
      { code: 'zero_categories', previous_count: 1, current_count: 0, delta: -1 },
    ])
  })

  it('rejects an iteration when a previously passing shop loses coverage', () => {
    const previousPassing = summarizeYupooShopRun({
      shop: { id: 'passed', url: 'https://passed.x.yupoo.com/' },
      result: makeResult(),
      artifactPath: 'passed.json',
      durationMs: 12,
    })
    const currentRegressed = summarizeYupooShopRun({
      shop: { id: 'passed', url: 'https://passed.x.yupoo.com/' },
      result: makeResult({ categories: [] }),
      artifactPath: 'passed-current.json',
      durationMs: 12,
    })
    const previous = analyzeYupooScrapeSummaries('runs/previous', [previousPassing])
    const current = analyzeYupooScrapeSummaries('runs/current', [currentRegressed])

    const comparison = compareYupooScrapeEvalReports({ previous, current, unitTestsPassed: true })

    expect(comparison.acceptance.accepted).toBe(false)
    expect(comparison.previously_passing_regressions).toEqual([
      expect.objectContaining({
        id: 'passed',
        category_count_delta: -1,
        preview_image_count_delta: -1,
        notes: expect.arrayContaining([
          'previously_passing_now_failing',
          'category_count_regressed',
          'preview_image_count_regressed',
        ]),
      }),
    ])
  })

  it('accepts an iteration when a previously passing shop gains preview coverage', () => {
    const previousPassing = summarizeYupooShopRun({
      shop: { id: 'passed', url: 'https://passed.x.yupoo.com/' },
      result: makeResult({
        categories: [
          {
            source_url: 'https://passed.x.yupoo.com/categories/111',
            category_path: ['categories', '111'],
            raw_label: 'Scarves',
            preview_image_urls: [],
            preview_image_status: 'fetched',
            extracted_at: fetchedAt,
            confidence: 0.9,
          },
        ],
      }),
      artifactPath: 'passed.json',
      durationMs: 12,
    })
    const currentImproved = summarizeYupooShopRun({
      shop: { id: 'passed', url: 'https://passed.x.yupoo.com/' },
      result: makeResult(),
      artifactPath: 'passed-current.json',
      durationMs: 12,
    })
    const previous = analyzeYupooScrapeSummaries('runs/previous', [previousPassing])
    const current = analyzeYupooScrapeSummaries('runs/current', [currentImproved])

    const comparison = compareYupooScrapeEvalReports({ previous, current, unitTestsPassed: true })

    expect(comparison.acceptance.accepted).toBe(true)
    expect(comparison.shop_deltas[0]).toMatchObject({
      improved: true,
      notes: expect.arrayContaining(['preview_image_count_improved']),
    })
  })
})

describe('frozen evasion fixtures (Wave 2 denominator for T019)', () => {
  const curatedBrands = [
    { canonical: 'arcteryx', display: "Arc'teryx", aliases: ['Maicai', 'Thorium'], embeddingTerms: ["Arc'teryx"] },
    { canonical: 'carhartt', display: 'Carhartt', aliases: ['Carhartt', 'Ca*har*t'], embeddingTerms: ['Carhartt'] },
    { canonical: 'acne', display: 'Acne Studios', aliases: ['Acne', 'AC*N*E'], embeddingTerms: ['Acne'] },
    { canonical: 'burberry', display: 'Burberry', aliases: ['Burberry', 'burserry'], embeddingTerms: ['Burberry'] },
    { canonical: 'prada', display: 'Prada', aliases: ['Prada', 'PDA'], embeddingTerms: ['Prada'] },
    { canonical: 'stone-island', display: 'Stone Island', aliases: ['stone island', 'SI', 'stoney'], embeddingTerms: ['Stone Island'] },
  ]

  it('freezes the live-observed evasion label set', () => {
    expect(FROZEN_EVASION_FIXTURES).toHaveLength(12)
    expect(FROZEN_EVASION_FIXTURES.map((fixture) => fixture.raw_label)).toContain('S****i****')
  })

  it('resolves every frozen evasion label to its expected brand or review', () => {
    const outcomes = FROZEN_EVASION_FIXTURES.map((fixture) => {
      const result = classifyDiscoveredCategory({
        raw_label: fixture.raw_label,
        category_path: ['fixtures'],
        source_url: 'https://fixture.invalid/',
        context: { canonical_brands: curatedBrands },
      })

      return {
        raw_label: fixture.raw_label,
        expected_brand: fixture.expected_brand,
        expect_review: fixture.expect_review,
        brand_signal: result.brand_signal,
        classification_status: result.classification_status,
      }
    })
    const summary = summarizeEvasionFixtureSet(outcomes)

    expect(summary.failures).toEqual([])
    expect(summary.resolution_rate).toBe(1)
  })

  it('flags missing live-observed labels in shop summaries', () => {
    const summary = summarizeYupooShopRun({
      shop: {
        id: 'west42',
        url: 'https://west42.x.yupoo.com/',
        expectations: {
          min_categories: 1,
          expected_labels: ['Thorium/Maicai/Down Jacket', 'Ca*har*t WIP'],
        },
      },
      result: makeResult({ categories: [] }),
      artifactPath: 'west42.json',
      durationMs: 12,
    })

    expect(summary.ok).toBe(false)
    expect(summary.failure_codes).toContain('missing_expected_labels')
  })
})

describe('evasion resolution rate (T019 >=80% computation point, no OCR)', () => {
  const curatedBrands = [
    { canonical: 'arcteryx', display: "Arc'teryx", aliases: ['Maicai', 'Thorium'], embeddingTerms: ["Arc'teryx"] },
    { canonical: 'carhartt', display: 'Carhartt', aliases: ['Carhartt', 'Ca*har*t'], embeddingTerms: ['Carhartt'] },
    { canonical: 'acne', display: 'Acne Studios', aliases: ['Acne', 'AC*N*E'], embeddingTerms: ['Acne'] },
    { canonical: 'burberry', display: 'Burberry', aliases: ['Burberry', 'burserry'], embeddingTerms: ['Burberry'] },
    { canonical: 'prada', display: 'Prada', aliases: ['Prada', 'PDA'], embeddingTerms: ['Prada'] },
    { canonical: 'stone-island', display: 'Stone Island', aliases: ['stone island', 'SI', 'stoney'], embeddingTerms: ['Stone Island'] },
  ]

  function classifyFixtures() {
    return FROZEN_EVASION_FIXTURES.map((fixture) => ({
      fixture,
      result: classifyDiscoveredCategory({
        raw_label: fixture.raw_label,
        category_path: ['fixtures'],
        source_url: 'https://fixture.invalid/',
        context: { canonical_brands: curatedBrands },
      }),
    }))
  }

  it('computes the evasion-label resolution rate over the frozen 12-label set', () => {
    const outcomes = classifyFixtures().map(({ fixture, result }) => ({
      raw_label: fixture.raw_label,
      expected_brand: fixture.expected_brand,
      expect_review: fixture.expect_review,
      brand_signal: result.brand_signal,
      classification_status: result.classification_status,
    }))
    const summary = summarizeEvasionFixtureSet(outcomes)

    expect(summary.total).toBe(12)
    expect(summary.resolution_rate).toBeGreaterThanOrEqual(0.8)
  })

  it('routes full-mask evasion into review and resolved variants into auto-accept', () => {
    const classified = classifyFixtures()

    for (const { fixture, result } of classified) {
      if (fixture.expect_review) {
        expect(result.classification_status).toBe('needs_review')
        expect(result.evidence.decision_reason).toBe('unresolved_label')
      } else {
        expect(result.brand_signal).toBe(fixture.expected_brand)
        expect(result.classification_status).toBe('auto_accepted')
      }
    }

    const reviewCount = classified.filter(({ result }) => result.classification_status === 'needs_review').length
    expect(reviewCount).toBe(3)
  })
})

describe('shop brand expectations (T019)', () => {
  const curatedBrands = [
    { canonical: 'arcteryx', display: "Arc'teryx", aliases: ['Maicai', 'Thorium'], embeddingTerms: ["Arc'teryx"] },
    { canonical: 'carhartt', display: 'Carhartt', aliases: ['Carhartt', 'Ca*har*t'], embeddingTerms: ['Carhartt'] },
  ]

  function brandResult(labels: string[]) {
    return makeResult({
      categories: labels.map((raw_label, index) => ({
        source_url: `https://west42.x.yupoo.com/categories/${index}`,
        category_path: ['categories', String(index)],
        raw_label,
        preview_image_urls: [],
        preview_image_status: 'fetched' as const,
        extracted_at: fetchedAt,
        confidence: 0.9,
      })),
    })
  }

  it('validates expected brand slugs', () => {
    const parsed = parseYupooShopEvalInput({
      shops: [
        {
          url: 'https://west42.x.yupoo.com',
          expectations: { min_categories: 1, expected_brands: ['arcteryx'] },
        },
      ],
    })

    expect(parsed.shops[0]?.expectations?.expected_brands).toEqual(['arcteryx'])
    expect(() =>
      parseYupooShopEvalInput({
        shops: [
          {
            url: 'https://west42.x.yupoo.com',
            expectations: { expected_brands: [''] },
          },
        ],
      }),
    ).toThrow('expected_brands')
  })

  it('passes when every expected brand resolves from scraped labels', () => {
    const summary = summarizeYupooShopRun({
      shop: {
        id: 'west42',
        url: 'https://west42.x.yupoo.com/',
        expectations: { min_categories: 1, expected_brands: ['arcteryx', 'carhartt'] },
      },
      result: brandResult(['Thorium/Maicai/Down Jacket', 'Ca*har*t WIP']),
      artifactPath: 'west42.json',
      durationMs: 12,
      canonical_brands: curatedBrands,
    })

    expect(summary.ok).toBe(true)
    expect(summary.brands).toEqual(['arcteryx', 'carhartt'])
    expect(summary.missing_brands).toEqual([])
  })

  it('reports missing_expected_brands as a failure mode', () => {
    const summary = summarizeYupooShopRun({
      shop: {
        id: 'west42',
        url: 'https://west42.x.yupoo.com/',
        expectations: { min_categories: 1, expected_brands: ['arcteryx', 'carhartt'] },
      },
      result: brandResult(['Thorium/Maicai/Down Jacket', 'S****i****']),
      artifactPath: 'west42.json',
      durationMs: 12,
      canonical_brands: curatedBrands,
    })

    expect(summary.ok).toBe(false)
    expect(summary.failure_codes).toContain('missing_expected_brands')
    expect(summary.missing_brands).toEqual(['carhartt'])
  })
})
