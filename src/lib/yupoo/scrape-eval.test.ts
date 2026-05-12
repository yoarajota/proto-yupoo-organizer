import { describe, expect, it } from 'vitest'
import {
  analyzeYupooScrapeSummaries,
  compareYupooScrapeEvalReports,
  parseYupooShopEvalInput,
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
