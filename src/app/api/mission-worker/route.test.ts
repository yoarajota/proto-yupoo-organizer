import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockCreateAdminClient = vi.fn()
const mockExecuteMissionStage = vi.fn()

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: mockCreateAdminClient,
}))

vi.mock('@/lib/mission-stage-runner', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/mission-stage-runner')>()
  return {
    ...actual,
    executeMissionStage: mockExecuteMissionStage,
  }
})

const { POST } = await import('./route')

function makeRequest(body: unknown, token?: string) {
  return new Request('http://localhost/api/mission-worker', {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

describe('/api/mission-worker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.MISSION_WORKER_TOKEN = 'worker-secret'
    mockCreateAdminClient.mockReturnValue({ from: vi.fn() })
    mockExecuteMissionStage.mockResolvedValue({ categories_count: 1 })
  })

  it('rejects missing token', async () => {
    const response = await POST(makeRequest({
      stage: 'discovery',
      payload: { mission_id: '550e8400-e29b-41d4-a716-446655440000' },
    }))

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mockExecuteMissionStage).not.toHaveBeenCalled()
  })

  it('rejects bad token', async () => {
    const response = await POST(makeRequest({
      stage: 'discovery',
      payload: { mission_id: '550e8400-e29b-41d4-a716-446655440000' },
    }, 'wrong-secret'))

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mockExecuteMissionStage).not.toHaveBeenCalled()
  })

  it('rejects invalid stage and payload', async () => {
    const response = await POST(makeRequest({
      stage: 'not-a-stage',
      payload: {},
    }, 'worker-secret'))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Invalid mission worker payload.' })
    expect(mockExecuteMissionStage).not.toHaveBeenCalled()
  })

  it('dispatches a valid stage and returns diagnostics', async () => {
    const payload = {
      mission_id: '550e8400-e29b-41d4-a716-446655440000',
      seed_url: 'https://shop.x.yupoo.com/',
    }

    const response = await POST(makeRequest({
      stage: 'discovery',
      payload,
    }, 'worker-secret'))

    expect(response.status).toBe(200)
    expect(mockCreateAdminClient).toHaveBeenCalled()
    expect(mockExecuteMissionStage).toHaveBeenCalledWith(
      expect.anything(),
      'discovery',
      payload,
    )
    expect(await response.json()).toEqual({
      mission_id: '550e8400-e29b-41d4-a716-446655440000',
      stage: 'discovery',
      result: { categories_count: 1 },
    })
  })
})
