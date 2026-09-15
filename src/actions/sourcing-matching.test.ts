import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetUser = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

const { executeMissionMatchingDirect: runMissionMatching } = await import('./sourcing-matching')

function makeMutatingChain(result = { error: null }) {
  const chain: Record<string, (...args: unknown[]) => unknown> = {}
  chain.update = () => chain
  chain.eq = () => chain
  chain.insert = () => Promise.resolve(result)
  chain.upsert = () => Promise.resolve(result)
  return chain
}

describe('runMissionMatching', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns validation error for invalid payload', async () => {
    const result = await runMissionMatching({ mission_id: 'bad-id' } as never)

    expect(result).toEqual({ data: null, error: { message: 'Invalid matching payload.' } })
  })

  it('returns unauthorized when no user exists', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const result = await runMissionMatching({ mission_id: '550e8400-e29b-41d4-a716-446655440000' })

    expect(result).toEqual({ data: null, error: { message: 'Unauthorized' } })
  })

  it('computes and persists ranked matches', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'sourcing_missions') {
        return {
          update: () => ({ eq: () => Promise.resolve({ error: null }) }),
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({
                data: { id: '550e8400-e29b-41d4-a716-446655440000', product_intent: 'women bags' },
                error: null,
              }),
            }),
          }),
        }
      }

      if (table === 'sourcing_mission_stage_metrics') {
        return makeMutatingChain({ error: null })
      }

      if (table === 'discovered_suppliers') {
        return {
          select: () => ({
            eq: () => Promise.resolve({
              data: [
                {
                  id: 'sup-1',
                  supplier_key: 'bagstore',
                  category_refs: ['women', 'bags'],
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
        return {
          upsert: () => Promise.resolve({ error: null }),
        }
      }

      return makeMutatingChain({ error: null })
    })

    const result = await runMissionMatching({
      mission_id: '550e8400-e29b-41d4-a716-446655440000',
      shortlist_limit: 5,
    })

    expect(result).toEqual({
      data: {
        mission_id: '550e8400-e29b-41d4-a716-446655440000',
        shortlisted_suppliers_count: 1,
        top_rank_score: expect.any(Number),
      },
      error: null,
    })
  })
})
