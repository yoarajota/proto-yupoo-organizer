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

const {
  generateOutreachSuggestions,
  approveOutreachSuggestion,
  exportOutreachSuggestion,
} = await import('./sourcing-outreach')

function makeMutatingChain(result = { error: null }) {
  const chain: Record<string, (...args: unknown[]) => unknown> = {}
  chain.update = () => chain
  chain.eq = () => chain
  chain.insert = () => Promise.resolve(result)
  chain.upsert = () => Promise.resolve(result)
  chain.select = () => chain
  chain.single = () => Promise.resolve(result)
  chain.order = () => Promise.resolve(result)
  chain.in = () => Promise.resolve(result)
  return chain
}

describe('sourcing outreach actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns validation error for invalid generate payload', async () => {
    const result = await generateOutreachSuggestions({ mission_id: 'bad-id' } as never)

    expect(result).toEqual({ data: null, error: { message: 'Invalid outreach payload.' } })
  })

  it('generates outreach suggestions from ranked matches', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'sourcing_mission_stage_metrics') return makeMutatingChain({ error: null })

      if (table === 'sourcing_missions') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({
                data: {
                  id: '550e8400-e29b-41d4-a716-446655440000',
                  product_intent: 'women bags',
                  destination_context: 'Brazil',
                  constraints: { color: 'black' },
                },
                error: null,
              }),
            }),
          }),
          update: () => ({
            eq: () => Promise.resolve({ error: null }),
          }),
        }
      }

      if (table === 'mission_supplier_matches') {
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({
                data: [{ supplier_id: 'sup-1', rank_score: 0.9 }],
                error: null,
              }),
            }),
          }),
        }
      }

      if (table === 'discovered_suppliers') {
        return {
          select: () => ({
            in: () => Promise.resolve({
              data: [{ id: 'sup-1', supplier_key: 'bagstore' }],
              error: null,
            }),
          }),
        }
      }

      if (table === 'outreach_suggestions') {
        return {
          upsert: () => Promise.resolve({ error: null }),
        }
      }

      return makeMutatingChain({ error: null })
    })

    const result = await generateOutreachSuggestions({
      mission_id: '550e8400-e29b-41d4-a716-446655440000',
      max_suggestions: 5,
    })

    expect(result).toEqual({
      data: {
        mission_id: '550e8400-e29b-41d4-a716-446655440000',
        suggestions_count: 1,
      },
      error: null,
    })
  })

  it('approves and exports a suggestion', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    mockFrom.mockImplementation(() => ({
      update: () => ({
        eq: () => ({
          eq: () => ({
            select: () => ({
              single: () => Promise.resolve({ data: { id: 'sug-1' }, error: null }),
            }),
          }),
          select: () => ({
            single: () => Promise.resolve({ data: { id: 'sug-1' }, error: null }),
          }),
        }),
      }),
    }))

    const approved = await approveOutreachSuggestion({ suggestion_id: '550e8400-e29b-41d4-a716-446655440001' })
    const exported = await exportOutreachSuggestion({ suggestion_id: '550e8400-e29b-41d4-a716-446655440001' })

    expect(approved.error).toBeNull()
    expect(exported.error).toBeNull()
  })
})
