import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetUser = vi.fn()
const mockFrom = vi.fn()
const mockWriteAgentRunArtifact = vi.fn()
const mockEnqueueMissionStage = vi.fn()

vi.mock('@/lib/mission-queue', () => ({
  enqueueMissionStage: mockEnqueueMissionStage,
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}))

vi.mock('@/lib/agent-logs', () => ({
  writeAgentRunArtifact: mockWriteAgentRunArtifact,
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

const {
  executeMissionCategoryClassificationDirect: runMissionCategoryClassification,
  runMissionCategoryClassificationWithFallback,
  reviewMissionCategoryClassification,
} = await import('./sourcing-classification')
const stageModule = await import('@/lib/mission-stage-runner')
const { enqueueMissionStage } = await import('@/lib/mission-queue')

function makeMutatingChain(result = { error: null }) {
  const chain: Record<string, (...args: unknown[]) => unknown> = {}
  chain.update = () => chain
  chain.eq = () => chain
  chain.insert = () => Promise.resolve(result)
  chain.upsert = () => Promise.resolve(result)
  chain.delete = () => chain
  chain.single = () => Promise.resolve(result)
  return chain
}

describe('runMissionCategoryClassification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockWriteAgentRunArtifact.mockResolvedValue({
      run_file: 'storage/agent-logs/classification/test.json',
      summary_file: 'storage/agent-logs/classification/summary.jsonl',
    })
  })

  it('returns validation error for invalid mission id', async () => {
    const result = await runMissionCategoryClassification({ mission_id: 'bad-id' } as never)

    expect(result).toEqual({ data: null, error: { message: 'Invalid classification payload.' } })
  })

  it('creates normalized category records and updates supplier refs', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    let discoveredCategoriesSelectCount = 0
    mockFrom.mockImplementation((table: string) => {
      if (table === 'sourcing_missions') {
        return {
          update: () => ({ eq: () => Promise.resolve({ error: null }) }),
        }
      }

      if (table === 'sourcing_mission_stage_metrics') {
        return makeMutatingChain({ error: null })
      }

      if (table === 'discovered_categories') {
        return {
          select: () => ({
            eq: () => {
              discoveredCategoriesSelectCount += 1

              if (discoveredCategoriesSelectCount === 1) {
                return Promise.resolve({
                  data: [
                    {
                      id: '550e8400-e29b-41d4-a716-446655440001',
                      mission_id: '550e8400-e29b-41d4-a716-446655440000',
                      source_url: 'https://shop.x.yupoo.com/categories/1',
                      category_path: ['categories', '1'],
                      raw_label: 'L V Bags',
                    },
                  ],
                  error: null,
                })
              }

              return Promise.resolve({
                data: [
                  {
                    id: '550e8400-e29b-41d4-a716-446655440001',
                    source_url: 'https://shop.x.yupoo.com/categories/1',
                    brand_signal: 'lv',
                    product_signal: 'bags',
                    classification_status: 'auto_accepted',
                  },
                ],
                error: null,
              })
            },
          }),
          upsert: vi.fn().mockResolvedValue({ error: null }),
        }
      }

      if (table === 'brands') {
        return {
          select: () => ({
            order: () => Promise.resolve({
              data: [
                {
                  slug: 'lv',
                  name: 'LV',
                  brand_aliases: [{ alias: 'L V' }],
                },
              ],
              error: null,
            }),
          }),
        }
      }

      if (table === 'product_types') {
        return {
          select: () => ({
            order: () => Promise.resolve({
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
          select: () => ({
            eq: () => Promise.resolve({
              data: [
                {
                  id: 'sup-1',
                  source_url: 'https://shop.x.yupoo.com',
                  category_refs: ['bags'],
                  normalized_category_refs: [],
                },
              ],
              error: null,
            }),
          }),
          update: () => ({ eq: () => Promise.resolve({ error: null }) }),
        }
      }

      return makeMutatingChain({ error: null })
    })

    const result = await runMissionCategoryClassification({
      mission_id: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(result).toEqual({
      data: {
        mission_id: '550e8400-e29b-41d4-a716-446655440000',
        total_categories_processed: 1,
        auto_accepted_categories: 1,
        review_required_categories: 0,
        normalized_supplier_refs_updated: 1,
        pending_reviews_count: 0,
        mission_status: 'completed',
      },
      error: null,
    })
    expect(mockWriteAgentRunArtifact).toHaveBeenCalledWith(
      'classification',
      '550e8400-e29b-41d4-a716-446655440000',
      expect.any(String),
      expect.objectContaining({
        diagnostics: expect.objectContaining({
          total_categories_scanned: 1,
        }),
        pending_reviews_count: 0,
      }),
    )
  })
})

describe('reviewMissionCategoryClassification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('marks manual review complete and advances the mission when the queue is cleared', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    let discoveredCategorySelectCount = 0
    mockFrom.mockImplementation((table: string) => {
      if (table === 'discovered_categories') {
        return {
          select: () => ({
            eq: () => {
              discoveredCategorySelectCount += 1

              if (discoveredCategorySelectCount === 1) {
                return {
                  single: () => Promise.resolve({
                    data: {
                      id: '550e8400-e29b-41d4-a716-446655440002',
                      mission_id: '550e8400-e29b-41d4-a716-446655440003',
                      source_url: 'https://shop.x.yupoo.com/categories/1',
                      category_path: ['categories', '1'],
                      raw_label: 'L V',
                      brand_signal: 'lv',
                      product_signal: 'bags',
                      classification_status: 'needs_review',
                      classification_confidence: 0.65,
                    },
                    error: null,
                  }),
                }
              }

              if (discoveredCategorySelectCount === 2) {
                return Promise.resolve({
                  data: [
                    {
                      source_url: 'https://shop.x.yupoo.com/categories/1',
                      brand_signal: 'lv',
                      product_signal: 'bags',
                      classification_status: 'reviewed',
                    },
                  ],
                  error: null,
                })
              }

              return Promise.resolve({
                data: [
                  {
                    id: '550e8400-e29b-41d4-a716-446655440002',
                    classification_status: 'reviewed',
                  },
                ],
                error: null,
              })
            },
          }),
          update: () => ({ eq: () => Promise.resolve({ error: null }) }),
        }
      }

      if (table === 'mission_category_classifications') {
        return {
          upsert: vi.fn().mockResolvedValue({ error: null }),
          delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
        }
      }

      if (table === 'brands') {
        return {
          select: () => ({
            order: () => Promise.resolve({
              data: [
                {
                  slug: 'lv',
                  name: 'LV',
                  brand_aliases: [{ alias: 'L V' }],
                },
              ],
              error: null,
            }),
          }),
        }
      }

      if (table === 'product_types') {
        return {
          select: () => ({
            order: () => Promise.resolve({
              data: [{ slug: 'bags', name: 'Bags' }],
              error: null,
            }),
          }),
        }
      }

      if (table === 'discovered_suppliers') {
        return {
          select: () => ({
            eq: () => Promise.resolve({
              data: [
                {
                  id: 'sup-1',
                  source_url: 'https://shop.x.yupoo.com',
                  category_refs: ['bags'],
                  normalized_category_refs: [],
                },
              ],
              error: null,
            }),
          }),
          update: () => ({ eq: () => Promise.resolve({ error: null }) }),
        }
      }

      if (table === 'sourcing_missions') {
        return {
          update: () => ({ eq: () => Promise.resolve({ error: null }) }),
        }
      }

      return makeMutatingChain({ error: null })
    })

    const result = await reviewMissionCategoryClassification({
      category_id: '550e8400-e29b-41d4-a716-446655440002',
      decision: 'accept',
    })

    expect(result).toEqual({
      data: {
        mission_id: '550e8400-e29b-41d4-a716-446655440003',
        category_id: '550e8400-e29b-41d4-a716-446655440002',
        decision: 'accept',
        pending_reviews_count: 0,
        normalized_supplier_refs_updated: 1,
        mission_status: 'completed',
      },
      error: null,
    })
  })
})

describe('reviewMissionCategoryClassification alias learning (Wave 2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function mockReviewTables(aliasInsert: ReturnType<typeof vi.fn>) {
    let discoveredCategorySelectCount = 0
    mockFrom.mockImplementation((table: string) => {
      if (table === 'discovered_categories') {
        return {
          select: () => ({
            eq: () => {
              discoveredCategorySelectCount += 1

              if (discoveredCategorySelectCount === 1) {
                return {
                  single: () => Promise.resolve({
                    data: {
                      id: '550e8400-e29b-41d4-a716-446655440010',
                      mission_id: '550e8400-e29b-41d4-a716-446655440011',
                      source_url: 'https://shop.x.yupoo.com/categories/9',
                      category_path: ['categories', '9'],
                      raw_label: 'Ca*har*t',
                      brand_signal: 'carhartt',
                      product_signal: null,
                      classification_status: 'needs_review',
                      classification_confidence: 0.65,
                    },
                    error: null,
                  }),
                }
              }

              return Promise.resolve({
                data: [
                  {
                    id: '550e8400-e29b-41d4-a716-446655440010',
                    classification_status: 'reviewed',
                  },
                ],
                error: null,
              })
            },
          }),
          update: () => ({ eq: () => Promise.resolve({ error: null }) }),
        }
      }

      if (table === 'mission_category_classifications') {
        return {
          upsert: vi.fn().mockResolvedValue({ error: null }),
          delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
        }
      }

      if (table === 'brands') {
        return {
          select: () => ({
            order: () => Promise.resolve({
              data: [
                {
                  id: 'brand-carhartt',
                  slug: 'carhartt',
                  name: 'Carhartt',
                  brand_aliases: [],
                },
              ],
              error: null,
            }),
          }),
        }
      }

      if (table === 'product_types') {
        return {
          select: () => ({
            order: () => Promise.resolve({ data: [], error: null }),
          }),
        }
      }

      if (table === 'brand_aliases') {
        return { insert: aliasInsert }
      }

      if (table === 'discovered_suppliers') {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: [], error: null }),
          }),
          update: () => ({ eq: () => Promise.resolve({ error: null }) }),
        }
      }

      if (table === 'sourcing_missions') {
        return {
          update: () => ({ eq: () => Promise.resolve({ error: null }) }),
        }
      }

      return makeMutatingChain({ error: null })
    })
  }

  it('writes the confirmed evasion variant into brand_aliases on approve', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    const aliasInsert = vi.fn().mockResolvedValue({ error: null })
    mockReviewTables(aliasInsert)

    const result = await reviewMissionCategoryClassification({
      category_id: '550e8400-e29b-41d4-a716-446655440010',
      decision: 'accept',
    })

    expect(result.error).toBeNull()
    expect(aliasInsert).toHaveBeenCalledWith({
      brand_id: 'brand-carhartt',
      alias: 'Ca*har*t',
      created_by: 'user-1',
    })
  })

  it('creates no alias on reject', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    const aliasInsert = vi.fn().mockResolvedValue({ error: null })
    mockReviewTables(aliasInsert)

    const result = await reviewMissionCategoryClassification({
      category_id: '550e8400-e29b-41d4-a716-446655440010',
      decision: 'reject',
    })

    expect(result.error).toBeNull()
    expect(aliasInsert).not.toHaveBeenCalled()
  })
})

describe('getMissionReviewQueue (Wave 5)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns batched product-only and brand-only items each with a suggested alias', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    const missionId = '550e8400-e29b-41d4-a716-446655440020'

    mockFrom.mockImplementation((table: string) => {
      if (table === 'discovered_categories') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => Promise.resolve({
                data: [
                  {
                    id: '550e8400-e29b-41d4-a716-446655440021',
                    mission_id: missionId,
                    raw_label: 'PDA pouches',
                    normalized_label: 'pda pouches',
                    brand_signal: null,
                    product_signal: 'pouches',
                    classification_confidence: 0.6,
                    classification_method: 'rules',
                    classification_status: 'needs_review',
                    preview_image_urls: [],
                    source_url: 'https://shop.x.yupoo.com/categories/1',
                  },
                  {
                    id: '550e8400-e29b-41d4-a716-446655440022',
                    mission_id: missionId,
                    raw_label: 'PRA*DA*',
                    normalized_label: 'prada',
                    brand_signal: 'prada',
                    product_signal: null,
                    classification_confidence: 0.65,
                    classification_method: 'rules',
                    classification_status: 'needs_review',
                    preview_image_urls: [],
                    source_url: 'https://shop.x.yupoo.com/categories/2',
                  },
                ],
                error: null,
              }),
            }),
          }),
        }
      }

      if (table === 'mission_category_classifications') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => Promise.resolve({
                data: [
                  {
                    canonical_brand: 'prada',
                    evidence: { raw_label: 'PDA pouches', decision: 'accept' },
                  },
                ],
                error: null,
              }),
            }),
          }),
        }
      }

      if (table === 'brands') {
        return {
          select: () => Promise.resolve({
            data: [
              { name: 'Prada', slug: 'prada', brand_aliases: [{ alias: 'PDA' }] },
            ],
            error: null,
          }),
        }
      }

      return makeMutatingChain({ error: null })
    })

    const { getMissionReviewQueue } = await import('./sourcing-classification')
    const result = await getMissionReviewQueue({ mission_id: missionId })

    expect(result.error).toBeNull()
    expect(result.data?.groups).toHaveLength(2)
    result.data?.groups.forEach((group) => {
      expect(group.suggested_alias).not.toBeNull()
    })
    expect(
      result.data?.groups.find((group) => group.brand_signal === null)?.suggested_alias,
    ).toMatchObject({ variant: 'PDA pouches', canonical: 'prada' })
    expect(
      result.data?.groups.find((group) => group.brand_signal === 'prada')?.suggested_alias,
    ).toMatchObject({ variant: 'PRA*DA*', canonical: 'prada' })
  })

  it('rejects malformed queue input', async () => {
    const { getMissionReviewQueue } = await import('./sourcing-classification')
    const result = await getMissionReviewQueue({ mission_id: 'not-a-uuid' })

    expect(result).toEqual({ data: null, error: { message: 'Invalid review queue payload.' } })
  })
})

describe('runMissionCategoryClassificationWithFallback', () => {
  const MISSION_ID = '550e8400-e29b-41d4-a716-446655440000'
  let prevWorkerUrl: string | undefined
  let prevWorkerToken: string | undefined
  let prevInline: string | undefined

  beforeEach(() => {
    vi.clearAllMocks()
    prevWorkerUrl = process.env.MISSION_WORKER_URL
    prevWorkerToken = process.env.MISSION_WORKER_TOKEN
    prevInline = process.env.MISSION_RUN_INLINE
    delete process.env.MISSION_WORKER_URL
    delete process.env.MISSION_WORKER_TOKEN
    delete process.env.MISSION_RUN_INLINE
    vi.stubEnv('NODE_ENV', 'test')
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
  })

  afterEach(() => {
    if (prevWorkerUrl === undefined) delete process.env.MISSION_WORKER_URL
    else process.env.MISSION_WORKER_URL = prevWorkerUrl
    if (prevWorkerToken === undefined) delete process.env.MISSION_WORKER_TOKEN
    else process.env.MISSION_WORKER_TOKEN = prevWorkerToken
    if (prevInline === undefined) delete process.env.MISSION_RUN_INLINE
    else process.env.MISSION_RUN_INLINE = prevInline
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('enqueues when worker env is present', async () => {
    process.env.MISSION_WORKER_URL = 'http://localhost:3090/api/mission-worker'
    process.env.MISSION_WORKER_TOKEN = 'test-token'
    const stageSpy = vi.spyOn(stageModule, 'executeMissionCategoryClassificationStage')
    mockEnqueueMissionStage.mockResolvedValue({
      data: {
        mission_id: MISSION_ID,
        stage: 'classifying_categories',
        status: 'classification_queued',
        processor_invoked: true,
      },
      error: null,
    })

    const result = await runMissionCategoryClassificationWithFallback({ mission_id: MISSION_ID })

    expect(mockEnqueueMissionStage).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ mission_id: MISSION_ID, stage: 'classifying_categories' }),
    )
    expect(enqueueMissionStage).toHaveBeenCalled()
    expect(stageSpy).not.toHaveBeenCalled()
    expect(result).toEqual({
      data: {
        mission_id: MISSION_ID,
        stage: 'classifying_categories',
        status: 'classification_queued',
        processor_invoked: true,
      },
      error: null,
    })
  })

  it('runs inline when worker env is absent', async () => {
    const stageSpy = vi
      .spyOn(stageModule, 'executeMissionCategoryClassificationStage')
      .mockResolvedValue({
        mission_id: MISSION_ID,
        total_categories_processed: 1,
        auto_accepted_categories: 0,
        review_required_categories: 1,
        normalized_supplier_refs_updated: 0,
        pending_reviews_count: 1,
        mission_status: 'completed',
      })

    const result = await runMissionCategoryClassificationWithFallback({ mission_id: MISSION_ID })

    expect(stageSpy).toHaveBeenCalledWith(expect.anything(), { mission_id: MISSION_ID })
    expect(mockEnqueueMissionStage).not.toHaveBeenCalled()
    expect(result).toEqual({
      data: {
        mission_id: MISSION_ID,
        total_categories_processed: 1,
        auto_accepted_categories: 0,
        review_required_categories: 1,
        normalized_supplier_refs_updated: 0,
        pending_reviews_count: 1,
        mission_status: 'completed',
      },
      error: null,
    })
  })

  it('falls through to Direct when the queue processor was never invoked', async () => {
    process.env.MISSION_WORKER_URL = 'http://172.24.227.250:3090/api/mission-worker'
    process.env.MISSION_WORKER_TOKEN = 'your-local-secret'
    const stageSpy = vi
      .spyOn(stageModule, 'executeMissionCategoryClassificationStage')
      .mockResolvedValue({
        mission_id: MISSION_ID,
        total_categories_processed: 1,
        auto_accepted_categories: 0,
        review_required_categories: 1,
        normalized_supplier_refs_updated: 0,
        pending_reviews_count: 1,
        mission_status: 'completed',
      })
    mockEnqueueMissionStage.mockResolvedValue({
      data: {
        mission_id: MISSION_ID,
        stage: 'classifying_categories',
        status: 'classification_queued',
        processor_invoked: false,
      },
      error: { message: 'MISSION_WORKER_URL and MISSION_WORKER_TOKEN must be configured before processing mission queue messages.' },
    })

    const result = await runMissionCategoryClassificationWithFallback({ mission_id: MISSION_ID })

    expect(mockEnqueueMissionStage).toHaveBeenCalled()
    expect(stageSpy).toHaveBeenCalledWith(expect.anything(), { mission_id: MISSION_ID })
    expect(result).toEqual({
      data: {
        mission_id: MISSION_ID,
        total_categories_processed: 1,
        auto_accepted_categories: 0,
        review_required_categories: 1,
        normalized_supplier_refs_updated: 0,
        pending_reviews_count: 1,
        mission_status: 'completed',
      },
      error: null,
    })
  })

  it('propagates the queue error when the processor was invoked', async () => {
    process.env.MISSION_WORKER_URL = 'http://localhost:3090/api/mission-worker'
    process.env.MISSION_WORKER_TOKEN = 'test-token'
    const stageSpy = vi
      .spyOn(stageModule, 'executeMissionCategoryClassificationStage')
      .mockResolvedValue({
        mission_id: MISSION_ID,
        total_categories_processed: 0,
        auto_accepted_categories: 0,
        review_required_categories: 0,
        normalized_supplier_refs_updated: 0,
        pending_reviews_count: 0,
        mission_status: 'completed',
      })
    mockEnqueueMissionStage.mockResolvedValue({
      data: {
        mission_id: MISSION_ID,
        stage: 'classifying_categories',
        status: 'classification_queued',
        processor_invoked: true,
      },
      error: { message: 'Mission worker failed with 500: boom' },
    })

    const result = await runMissionCategoryClassificationWithFallback({ mission_id: MISSION_ID })

    expect(mockEnqueueMissionStage).toHaveBeenCalled()
    expect(stageSpy).not.toHaveBeenCalled()
    expect(result).toEqual({
      data: {
        mission_id: MISSION_ID,
        stage: 'classifying_categories',
        status: 'classification_queued',
        processor_invoked: true,
      },
      error: { message: 'Mission worker failed with 500: boom' },
    })
  })

  it('runs inline without touching the queue when MISSION_RUN_INLINE=true, even with worker env present', async () => {
    process.env.MISSION_RUN_INLINE = 'true'
    process.env.MISSION_WORKER_URL = 'http://localhost:3090/api/mission-worker'
    process.env.MISSION_WORKER_TOKEN = 'test-token'
    const stageSpy = vi
      .spyOn(stageModule, 'executeMissionCategoryClassificationStage')
      .mockResolvedValue({
        mission_id: MISSION_ID,
        total_categories_processed: 2,
        auto_accepted_categories: 1,
        review_required_categories: 1,
        normalized_supplier_refs_updated: 0,
        pending_reviews_count: 1,
        mission_status: 'completed',
      })

    const result = await runMissionCategoryClassificationWithFallback({ mission_id: MISSION_ID })

    expect(stageSpy).toHaveBeenCalledWith(expect.anything(), { mission_id: MISSION_ID })
    expect(mockEnqueueMissionStage).not.toHaveBeenCalled()
    expect(result.error).toBeNull()
  })

  it('takes the enqueue path when MISSION_RUN_INLINE=false and worker env is present', async () => {
    process.env.MISSION_RUN_INLINE = 'false'
    process.env.MISSION_WORKER_URL = 'http://localhost:3090/api/mission-worker'
    process.env.MISSION_WORKER_TOKEN = 'test-token'
    const stageSpy = vi.spyOn(stageModule, 'executeMissionCategoryClassificationStage')
    mockEnqueueMissionStage.mockResolvedValue({
      data: {
        mission_id: MISSION_ID,
        stage: 'classifying_categories',
        status: 'classification_queued',
        processor_invoked: true,
      },
      error: null,
    })

    const result = await runMissionCategoryClassificationWithFallback({ mission_id: MISSION_ID })

    expect(mockEnqueueMissionStage).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ mission_id: MISSION_ID, stage: 'classifying_categories' }),
    )
    expect(stageSpy).not.toHaveBeenCalled()
    expect(result.error).toBeNull()
  })

  it('defaults to inline in development when the flag is unset, even with worker env present', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    process.env.MISSION_WORKER_URL = 'http://localhost:3090/api/mission-worker'
    process.env.MISSION_WORKER_TOKEN = 'test-token'
    const stageSpy = vi
      .spyOn(stageModule, 'executeMissionCategoryClassificationStage')
      .mockResolvedValue({
        mission_id: MISSION_ID,
        total_categories_processed: 1,
        auto_accepted_categories: 0,
        review_required_categories: 1,
        normalized_supplier_refs_updated: 0,
        pending_reviews_count: 1,
        mission_status: 'completed',
      })

    const result = await runMissionCategoryClassificationWithFallback({ mission_id: MISSION_ID })

    expect(stageSpy).toHaveBeenCalledWith(expect.anything(), { mission_id: MISSION_ID })
    expect(mockEnqueueMissionStage).not.toHaveBeenCalled()
    expect(result.error).toBeNull()
  })

  it('defaults to the queue path outside development when the flag is unset and worker env is present', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    process.env.MISSION_WORKER_URL = 'http://localhost:3090/api/mission-worker'
    process.env.MISSION_WORKER_TOKEN = 'test-token'
    const stageSpy = vi.spyOn(stageModule, 'executeMissionCategoryClassificationStage')
    mockEnqueueMissionStage.mockResolvedValue({
      data: {
        mission_id: MISSION_ID,
        stage: 'classifying_categories',
        status: 'classification_queued',
        processor_invoked: true,
      },
      error: null,
    })

    const result = await runMissionCategoryClassificationWithFallback({ mission_id: MISSION_ID })

    expect(mockEnqueueMissionStage).toHaveBeenCalled()
    expect(stageSpy).not.toHaveBeenCalled()
    expect(result.error).toBeNull()
  })
})
