import { describe, it, expect, vi, beforeEach } from 'vitest'

function makeBuilder(terminalValue: unknown) {
  const builder: Record<string, unknown> = {}
  const chainMethods = ['select', 'eq', 'insert', 'update', 'upsert', 'delete', 'order']
  chainMethods.forEach((method) => {
    builder[method] = () => builder
  })
  builder.single = () => Promise.resolve(terminalValue)
  return builder
}

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
  createSourcingMission,
  updateSourcingMissionStatus,
  deleteSourcingMission,
  getSourcingMissionMetrics,
} = await import('./sourcing-missions')

describe('createSourcingMission', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns validation error for invalid seed URL', async () => {
    const result = await createSourcingMission({ seed_url: 'not-a-url' })

    expect(result).toEqual({ data: null, error: { message: 'Invalid mission data.' } })
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('returns unauthorized when no user exists', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const result = await createSourcingMission({
      seed_url: 'https://west42.x.yupoo.com/',
    })

    expect(result).toEqual({ data: null, error: { message: 'Unauthorized' } })
  })

  it('returns mission data on success', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    const mission = {
      id: 'mission-1',
      product_intent: 'women sneakers',
      seed_url: 'https://west42.x.yupoo.com/',
      status: 'created',
    }
    mockFrom.mockReturnValueOnce(makeBuilder({ data: mission, error: null }))

    const result = await createSourcingMission({
      seed_url: 'https://west42.x.yupoo.com/',
    })

    expect(result).toEqual({ data: mission, error: null })
  })
})

describe('updateSourcingMissionStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns validation error for invalid status', async () => {
    const result = await updateSourcingMissionStatus('mission-1', 'not_a_valid_state' as never)

    expect(result).toEqual({ data: null, error: { message: 'Invalid mission status.' } })
  })

  it('returns updated mission on success', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    const updatedMission = { id: 'mission-1', status: 'matching' }
    mockFrom.mockReturnValueOnce(makeBuilder({ data: updatedMission, error: null }))

    const result = await updateSourcingMissionStatus('mission-1', 'matching')

    expect(result).toEqual({ data: updatedMission, error: null })
  })
})

describe('deleteSourcingMission', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns validation error for invalid mission id', async () => {
    const result = await deleteSourcingMission('mission-1')

    expect(result).toEqual({ data: null, error: { message: 'Invalid mission id.' } })
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('returns unauthorized when no user exists', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const result = await deleteSourcingMission('9325489e-9a73-41c6-a583-d437074882d9')

    expect(result).toEqual({ data: null, error: { message: 'Unauthorized' } })
  })

  it('deletes mission on success', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    const deletedMission = { id: '9325489e-9a73-41c6-a583-d437074882d9' }
    mockFrom.mockReturnValueOnce(makeBuilder({ data: deletedMission, error: null }))

    const result = await deleteSourcingMission('9325489e-9a73-41c6-a583-d437074882d9')

    expect(result).toEqual({ data: deletedMission, error: null })
  })
})

describe('getSourcingMissionMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns mission and stage metrics', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const mission = {
      id: 'mission-1',
      status: 'created',
      created_at: '2026-04-23T00:00:00.000Z',
      first_suggestion_batch_at: null,
      first_valid_quote_at: null,
    }

    const stageMetrics = [
      {
        stage_name: 'discovery',
        started_at: '2026-04-23T00:01:00.000Z',
        finished_at: '2026-04-23T00:01:04.000Z',
        duration_ms: 4000,
      },
    ]

    mockFrom
      .mockReturnValueOnce(makeBuilder({ data: mission, error: null }))
      .mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            order: () => Promise.resolve({ data: stageMetrics, error: null }),
          }),
        }),
      })

    const result = await getSourcingMissionMetrics('mission-1')

    expect(result).toEqual({
      data: {
        mission,
        stage_metrics: stageMetrics,
      },
      error: null,
    })
  })
})
