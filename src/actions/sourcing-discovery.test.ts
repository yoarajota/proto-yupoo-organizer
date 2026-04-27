import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetUser = vi.fn()
const mockFrom = vi.fn()
const mockWriteAgentRunArtifact = vi.fn()

vi.mock('@/lib/yupoo/scout', () => ({
  crawlYupooDiscovery: vi.fn(),
  extractDiscoveryFromHtml: vi.fn(),
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

const { extractDiscoveryFromHtml } = await import('@/lib/yupoo/scout')
const { runMissionDiscovery } = await import('./sourcing-discovery')

function makeChain(result = { error: null }) {
  const chain: Record<string, (...args: unknown[]) => unknown> = {}

  chain.update = () => chain
  chain.eq = () => chain
  chain.insert = () => Promise.resolve(result)
  chain.upsert = () => Promise.resolve(result)

  return chain
}

describe('runMissionDiscovery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockWriteAgentRunArtifact.mockResolvedValue({
      run_file: 'storage/agent-logs/scouting/test.json',
      summary_file: 'storage/agent-logs/scouting/summary.jsonl',
    })
  })

  it('returns validation error for invalid mission id', async () => {
    const result = await runMissionDiscovery({ mission_id: 'bad-id', seed_url: 'https://www.yupoo.com' } as never)

    expect(result).toEqual({ data: null, error: { message: 'Invalid discovery payload.' } })
  })

  it('returns unauthorized when no user exists', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const result = await runMissionDiscovery({
      mission_id: '550e8400-e29b-41d4-a716-446655440000',
      html_snapshot: '<a href="https://shop.x.yupoo.com/categories/1">shop</a>',
    })

    expect(result).toEqual({ data: null, error: { message: 'Unauthorized' } })
  })

  it('persists discovered categories and suppliers from html snapshot', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const upsertSpy = vi.fn().mockResolvedValue({ error: null })
    const chain = makeChain({ error: null })
    chain.upsert = upsertSpy
    mockFrom.mockImplementation((table: string) => {
      if (table === 'sourcing_missions') {
        return {
          update: () => ({ eq: () => Promise.resolve({ error: null }) }),
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({
                data: {
                  id: '550e8400-e29b-41d4-a716-446655440000',
                  seed_url: 'https://west42.x.yupoo.com/',
                },
                error: null,
              }),
            }),
          }),
        }
      }

      return chain
    })

    vi.mocked(extractDiscoveryFromHtml).mockReturnValue({
      categories: [
        {
          source_url: 'https://shop.x.yupoo.com/categories/1',
          category_path: ['categories', '1'],
          raw_label: 'L V Bags',
          extracted_at: '2026-04-23T00:00:00.000Z',
          confidence: 0.7,
        },
      ],
      suppliers: [
        {
          supplier_key: 'shop.x',
          source_url: 'https://shop.x.yupoo.com',
          category_refs: ['categories', '1'],
          normalized_category_refs: [],
          last_seen_at: '2026-04-23T00:00:00.000Z',
          confidence: 0.65,
        },
      ],
    })

    const result = await runMissionDiscovery({
      mission_id: '550e8400-e29b-41d4-a716-446655440000',
      html_snapshot: '<a href="https://shop.x.yupoo.com/categories/1">shop</a>',
    })

    expect(result).toEqual({
      data: {
        mission_id: '550e8400-e29b-41d4-a716-446655440000',
        categories_count: 1,
        suppliers_count: 1,
      },
      error: null,
    })

    expect(upsertSpy).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          raw_label: 'L V Bags',
        }),
      ]),
      expect.anything(),
    )

    expect(extractDiscoveryFromHtml).toHaveBeenCalledWith(
      '<a href="https://shop.x.yupoo.com/categories/1">shop</a>',
      'https://west42.x.yupoo.com/',
      expect.any(String),
    )
    expect(mockWriteAgentRunArtifact).toHaveBeenCalledWith(
      'scouting',
      '550e8400-e29b-41d4-a716-446655440000',
      expect.any(String),
      expect.objectContaining({
        categories_count: 1,
        suppliers_count: 1,
      }),
    )
  })
})
