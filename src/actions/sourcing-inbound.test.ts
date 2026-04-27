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

const { ingestInboundMessage, parseInboundOffers } = await import('./sourcing-inbound')

function makeMutatingChain(result = { error: null }) {
  const chain: Record<string, (...args: unknown[]) => unknown> = {}
  chain.update = () => chain
  chain.eq = () => chain
  chain.insert = () => Promise.resolve(result)
  chain.upsert = () => Promise.resolve(result)
  return chain
}

describe('sourcing inbound actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns validation error for invalid ingest payload', async () => {
    const result = await ingestInboundMessage({ mission_id: 'bad-id' } as never)

    expect(result).toEqual({ data: null, error: { message: 'Invalid inbound payload.' } })
  })

  it('ingests inbound message when payload is valid', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'supplier_messages') {
        return {
          insert: () => ({
            select: () => ({
              single: () => Promise.resolve({ data: { id: 'msg-1' }, error: null }),
            }),
          }),
        }
      }
      return makeMutatingChain({ error: null })
    })

    const result = await ingestInboundMessage({
      mission_id: '550e8400-e29b-41d4-a716-446655440010',
      supplier_id: '550e8400-e29b-41d4-a716-446655440011',
      channel: 'whatsapp',
      body: 'Price=45 USD MOQ=10 Lead Time=5 days',
    })

    expect(result).toEqual({ data: { id: 'msg-1' }, error: null })
  })

  it('parses inbound messages and persists offers/catalogue summaries', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'sourcing_missions') {
        return {
          update: () => ({
            eq: () => Promise.resolve({ error: null }),
          }),
        }
      }

      if (table === 'sourcing_mission_stage_metrics') {
        return makeMutatingChain({ error: null })
      }

      if (table === 'supplier_messages') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({
                  limit: () => Promise.resolve({
                    data: [
                      {
                        id: 'msg-1',
                        supplier_id: '550e8400-e29b-41d4-a716-446655440011',
                        body: 'Price=48 USD | MOQ=20 | Lead Time=7 days | Catalogue=https://supplier.example/catalog',
                        received_or_sent_at: '2026-04-23T00:00:00.000Z',
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }
      }

      if (table === 'normalized_offers' || table === 'catalogue_summaries') {
        return {
          upsert: () => Promise.resolve({ error: null }),
        }
      }

      return makeMutatingChain({ error: null })
    })

    const result = await parseInboundOffers({
      mission_id: '550e8400-e29b-41d4-a716-446655440010',
      max_messages: 20,
    })

    expect(result).toEqual({
      data: {
        mission_id: '550e8400-e29b-41d4-a716-446655440010',
        offers_count: 1,
        catalogue_summaries_count: 1,
      },
      error: null,
    })
  })
})
