import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/agent-logs', () => ({
  writeAgentRunArtifact: vi.fn().mockResolvedValue({
    run_file: 'storage/agent-logs/classification/test.json',
    summary_file: 'storage/agent-logs/classification/summary.jsonl',
  }),
}))

const {
  executeMissionStage,
  executeMissionCategoryClassificationStage,
  executeMissionDiscoveryStage,
} = await import('./mission-stage-runner')

const MISSION_ID = '550e8400-e29b-41d4-a716-446655440000'

function makeMetricsTable() {
  return {
    insert: vi.fn().mockResolvedValue({ error: null }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    }),
  }
}

function makeClassificationSupabase(input: {
  categories: unknown[]
  suppliers: unknown[]
  supplierUpdateError?: string | null
}) {
  const supplierUpdateEq = vi.fn().mockImplementation(() =>
    Promise.resolve(
      input.supplierUpdateError
        ? { error: { message: input.supplierUpdateError } }
        : { error: null },
    ),
  )
  const supplierUpdate = vi.fn().mockReturnValue({ eq: supplierUpdateEq })
  const eventInsert = vi.fn().mockResolvedValue({ error: null })
  const metricsInsert = vi.fn().mockResolvedValue({ error: null })
  let categorySelectCount = 0

  const supabase = {
    from: vi.fn((table: string) => {
      if (table === 'sourcing_mission_stage_events') {
        return { insert: eventInsert }
      }

      if (table === 'sourcing_missions') {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        }
      }

      if (table === 'sourcing_mission_stage_metrics') {
        return {
          insert: metricsInsert,
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ error: null }),
              }),
            }),
          }),
        }
      }

      if (table === 'discovered_categories') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation(() => {
              categorySelectCount += 1
              if (categorySelectCount === 1) {
                return Promise.resolve({ data: input.categories, error: null })
              }
              return Promise.resolve({
                data: (input.categories as Array<{ source_url: string }>).map((category) => ({
                  source_url: category.source_url,
                  brand_signal: 'lv',
                  product_signal: 'bags',
                  classification_status: 'auto_accepted',
                })),
                error: null,
              })
            }),
          }),
          upsert: vi.fn().mockResolvedValue({ error: null }),
        }
      }

      if (table === 'brands') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [{ slug: 'lv', name: 'LV', brand_aliases: [{ alias: 'L V' }] }],
              error: null,
            }),
          }),
        }
      }

      if (table === 'product_types') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [{ slug: 'bags', name: 'Bags' }],
              error: null,
            }),
          }),
        }
      }

      if (table === 'mission_category_classifications') {
        return {
          upsert: vi.fn().mockResolvedValue({ error: null }),
        }
      }

      if (table === 'discovered_suppliers') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: input.suppliers, error: null }),
          }),
          update: supplierUpdate,
        }
      }

      throw new Error(`unexpected table ${table}`)
    }),
  }

  return { supabase, supplierUpdate, supplierUpdateEq, eventInsert, metricsInsert }
}

describe('executeMissionCategoryClassificationStage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('overwrites extraction-seeded refs with canonical classification refs', async () => {
    const { supabase, supplierUpdate, supplierUpdateEq } = makeClassificationSupabase({
      categories: [
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          mission_id: MISSION_ID,
          source_url: 'https://shop.x.yupoo.com/categories/1',
          category_path: ['categories', '1'],
          raw_label: 'L V Bags',
        },
      ],
      suppliers: [
        {
          id: 'sup-1',
          source_url: 'https://shop.x.yupoo.com',
          category_refs: ['bags'],
          normalized_category_refs: ['stale-ref'],
        },
      ],
    })

    const result = await executeMissionCategoryClassificationStage(supabase as never, {
      mission_id: MISSION_ID,
    })

    expect(result.mission_id).toBe(MISSION_ID)
    expect(result.total_categories_processed).toBe(1)
    expect(result.normalized_supplier_refs_updated).toBe(1)
    expect(supplierUpdate).toHaveBeenCalledTimes(1)
    expect(supplierUpdateEq).toHaveBeenCalledWith('id', 'sup-1')

    const written = supplierUpdate.mock.calls[0]?.[0] as {
      normalized_category_refs: string[]
    }
    expect(written).not.toHaveProperty('id')
    expect(written).not.toHaveProperty('mission_id')
    expect(written.normalized_category_refs).toEqual(expect.arrayContaining(['bags', 'lv']))
    expect(written.normalized_category_refs).not.toContain('stale-ref')
  })

  it('leaves suppliers untouched when classification yields nothing', async () => {
    const { supabase, supplierUpdate } = makeClassificationSupabase({
      categories: [],
      suppliers: [
        {
          id: 'sup-1',
          source_url: 'https://shop.x.yupoo.com',
          category_refs: ['bags'],
          normalized_category_refs: ['stale-ref'],
        },
      ],
    })

    const result = await executeMissionCategoryClassificationStage(supabase as never, {
      mission_id: MISSION_ID,
    })

    expect(result.total_categories_processed).toBe(0)
    expect(result.normalized_supplier_refs_updated).toBe(0)
    expect(supplierUpdate).not.toHaveBeenCalled()
  })

  it('updates each supplier row with its own id filter', async () => {
    const { supabase, supplierUpdate, supplierUpdateEq } = makeClassificationSupabase({
      categories: [
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          mission_id: MISSION_ID,
          source_url: 'https://shop.x.yupoo.com/categories/1',
          category_path: ['categories', '1'],
          raw_label: 'L V Bags',
        },
      ],
      suppliers: [
        {
          id: 'sup-1',
          source_url: 'https://shop.x.yupoo.com',
          category_refs: ['bags'],
          normalized_category_refs: ['stale-ref'],
        },
        {
          id: 'sup-2',
          source_url: 'https://shop.x.yupoo.com',
          category_refs: ['bags'],
          normalized_category_refs: [],
        },
      ],
    })

    const result = await executeMissionCategoryClassificationStage(supabase as never, {
      mission_id: MISSION_ID,
    })

    expect(result.normalized_supplier_refs_updated).toBe(2)
    expect(supplierUpdate).toHaveBeenCalledTimes(2)
    expect(supplierUpdateEq).toHaveBeenCalledWith('id', 'sup-1')
    expect(supplierUpdateEq).toHaveBeenCalledWith('id', 'sup-2')
  })

  it('fails the stage when a supplier ref update fails', async () => {
    const { supabase } = makeClassificationSupabase({
      categories: [
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          mission_id: MISSION_ID,
          source_url: 'https://shop.x.yupoo.com/categories/1',
          category_path: ['categories', '1'],
          raw_label: 'L V Bags',
        },
      ],
      suppliers: [
        {
          id: 'sup-1',
          source_url: 'https://shop.x.yupoo.com',
          category_refs: ['bags'],
          normalized_category_refs: ['stale-ref'],
        },
      ],
      supplierUpdateError: 'ref update boom',
    })

    await expect(
      executeMissionCategoryClassificationStage(supabase as never, {
        mission_id: MISSION_ID,
      }),
    ).rejects.toThrow('ref update boom')
  })

  it('persists the category strategy rollup and emits stage metrics and events', async () => {
    const { supabase, eventInsert, metricsInsert } = makeClassificationSupabase({
      categories: [
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          mission_id: MISSION_ID,
          source_url: 'https://shop.x.yupoo.com/categories/1',
          category_path: ['categories', '1'],
          raw_label: 'L V Bags',
        },
      ],
      suppliers: [],
    })

    await executeMissionCategoryClassificationStage(supabase as never, {
      mission_id: MISSION_ID,
    })

    expect(metricsInsert).toHaveBeenCalledWith(
      expect.objectContaining({ mission_id: MISSION_ID, stage_name: 'classifying_categories' }),
    )
    const strategyCalls = eventInsert.mock.calls.filter(
      (call) => (call[0] as { event_name?: string }).event_name === 'worker_classification_strategy_rolled_up',
    )
    expect(strategyCalls).toHaveLength(1)
    expect(strategyCalls[0]?.[0]).toMatchObject({
      mission_id: MISSION_ID,
      stage_name: 'classifying_categories',
      diagnostics: expect.objectContaining({ group_count: 1 }),
    })
  })
})

describe('executeMissionStage dispatcher', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('routes queued matching payloads to the matching stage instead of throwing', async () => {
    const eventInsert = vi.fn().mockResolvedValue({ error: null })
    const matchesUpsert = vi.fn().mockResolvedValue({ error: null })

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'sourcing_mission_stage_events') {
          return { insert: eventInsert }
        }

        if (table === 'sourcing_missions') {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: MISSION_ID, product_intent: 'lv bags' },
                  error: null,
                }),
              }),
            }),
          }
        }

        if (table === 'sourcing_mission_stage_metrics') {
          return makeMetricsTable()
        }

        if (table === 'discovered_suppliers') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 'sup-1',
                    supplier_key: 'bagstore',
                    category_refs: ['bags'],
                    normalized_category_refs: ['bags'],
                    last_seen_at: '2026-04-23T00:00:00.000Z',
                    confidence: 0.8,
                  },
                ],
                error: null,
              }),
            }),
          }
        }

        if (table === 'mission_supplier_matches') {
          return { upsert: matchesUpsert }
        }

        throw new Error(`unexpected table ${table}`)
      }),
    }

    const result = await executeMissionStage(supabase as never, 'matching', {
      mission_id: MISSION_ID,
      shortlist_limit: 5,
    }) as { mission_id: string; shortlisted_suppliers_count: number }

    expect(result.mission_id).toBe(MISSION_ID)
    expect(result.shortlisted_suppliers_count).toBe(1)
    expect(matchesUpsert).toHaveBeenCalledTimes(1)
    expect(eventInsert).toHaveBeenCalledWith(
      expect.objectContaining({ event_name: 'worker_succeeded' }),
    )
    const failedCalls = eventInsert.mock.calls.filter(
      (call) => (call[0] as { event_name?: string }).event_name === 'worker_failed',
    )
    expect(failedCalls).toHaveLength(0)
  })
})

describe('executeMissionDiscoveryStage yupoo image ingest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('ingests scraped yupoo preview images into mission-scoped photo_hashes rows', async () => {
    const eventInsert = vi.fn().mockResolvedValue({ error: null })
    const metricsInsert = vi.fn().mockResolvedValue({ error: null })
    const photoHashInserts: unknown[] = []
    const uploads: string[] = []

    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), {
          status: 200,
          headers: { 'content-type': 'image/jpeg' },
        }),
      ),
    )

    const supabase = {
      storage: {
        from: vi.fn(() => ({
          upload: vi.fn(async (path: string) => {
            uploads.push(path)
            return { data: { path }, error: null }
          }),
        })),
      },
      from: vi.fn((table: string) => {
        if (table === 'sourcing_missions') {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: MISSION_ID, seed_url: 'https://west42.x.yupoo.com/categories/4791339' },
                  error: null,
                }),
              }),
            }),
          }
        }

        if (table === 'sourcing_mission_stage_metrics') {
          return {
            insert: metricsInsert,
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockResolvedValue({ error: null }),
                }),
              }),
            }),
          }
        }

        if (table === 'sourcing_mission_stage_events') {
          return { insert: eventInsert }
        }

        if (table === 'discovered_categories') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
            upsert: vi.fn().mockResolvedValue({ error: null }),
          }
        }

        if (table === 'discovered_suppliers') {
          return { upsert: vi.fn().mockResolvedValue({ error: null }) }
        }

        if (table === 'photo_hashes') {
          return {
            insert: vi.fn((row: unknown) => {
              photoHashInserts.push(row)
              return {
                select: vi.fn(() => ({
                  single: vi.fn(async () => ({ data: { id: 'hash-1' }, error: null })),
                })),
              }
            }),
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  limit: vi.fn(async () => ({ data: [], error: null })),
                })),
              })),
            })),
          }
        }

        throw new Error(`unexpected table ${table}`)
      }),
    }

    const result = await executeMissionDiscoveryStage(supabase as never, {
      mission_id: MISSION_ID,
      seed_url: 'https://west42.x.yupoo.com/categories/4791339',
      html_snapshot: `
        <div class="categories__box-left">
          <a href="/categories/4791339" title="25SS Beta SL/LW">15</a>
        </div>
        <div class="categories__children">
          <div data-type="photo" data-src="https://photo.yupoo.com/west42/beta-1/medium.jpg"></div>
        </div>
      `,
    })

    expect(result.mission_id).toBe(MISSION_ID)
    expect(uploads).toHaveLength(1)
    expect(uploads[0]?.startsWith(`missions/${MISSION_ID}/`)).toBe(true)
    expect(photoHashInserts).toHaveLength(1)
    expect(photoHashInserts[0]).toMatchObject({
      mission_id: MISSION_ID,
      product_id: null,
      created_by: null,
      download_status: 'downloaded',
      phash_status: 'pending',
    })

    const eventNames = eventInsert.mock.calls.map(
      (call) => (call[0] as { event_name?: string }).event_name,
    )
    expect(eventNames).toContain('worker_discovery_images_ingested')
    expect(eventNames).not.toContain('worker_failed')
    expect(metricsInsert).toHaveBeenCalledWith(
      expect.objectContaining({ mission_id: MISSION_ID, stage_name: 'discovery' }),
    )

    vi.unstubAllGlobals()
  })
})
