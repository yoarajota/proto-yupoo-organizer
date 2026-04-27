import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetUser = vi.fn()
const mockFrom = vi.fn()
const mockWriteAgentRunArtifact = vi.fn()

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
  runMissionCategoryClassification,
  reviewMissionCategoryClassification,
} = await import('./sourcing-classification')

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
                      raw_label: 'Loui Vuiton Bags',
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
          upsert: vi.fn().mockResolvedValue({ error: null }),
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
        mission_status: 'matching',
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
          upsert: vi.fn().mockResolvedValue({ error: null }),
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
        mission_status: 'matching',
      },
      error: null,
    })
  })
})
