import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetUser = vi.fn()
const mockFrom = vi.fn()
const mockWriteAgentRunArtifact = vi.fn()
const mockEnqueueMissionStage = vi.fn()

vi.mock('@/lib/yupoo/scout', () => ({
  scrapeYupooDiscovery: vi.fn(),
  extractDiscoveryFromHtml: vi.fn(),
}))

vi.mock('@/lib/mission-stage-runner', () => ({
  executeMissionDiscoveryStage: vi.fn(),
}))

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

const { extractDiscoveryFromHtml, scrapeYupooDiscovery } = await import('@/lib/yupoo/scout')
const { executeMissionDiscoveryStage } = await import('@/lib/mission-stage-runner')
const { enqueueMissionStage } = await import('@/lib/mission-queue')
const { executeMissionDiscoveryDirect: runMissionDiscovery, runMissionDiscoveryWithFallback } = await import('./sourcing-discovery')

const MISSION_ID = '550e8400-e29b-41d4-a716-446655440000'

function mockMissionLookup() {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'sourcing_missions') {
      return {
        update: () => ({ eq: () => Promise.resolve({ error: null }) }),
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({
              data: { id: MISSION_ID, seed_url: 'https://west42.x.yupoo.com/' },
              error: null,
            }),
          }),
        }),
      }
    }

    return makeChain({ error: null })
  })
}

function makeChain(result = { error: null }) {
  const chain: Record<string, (...args: unknown[]) => unknown> = {}

  chain.update = () => chain
  chain.eq = () => chain
  chain.in = () => Promise.resolve(result)
  chain.insert = () => Promise.resolve(result)
  chain.delete = () => chain
  chain.select = () => chain
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
})

describe('executeMissionDiscoveryDirect delegation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockWriteAgentRunArtifact.mockResolvedValue({
      run_file: 'storage/agent-logs/scouting/test.json',
      summary_file: 'storage/agent-logs/scouting/summary.jsonl',
    })
  })

  it('delegates to the shared discovery stage with parsed input and returns stage data', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockMissionLookup()
    vi.mocked(scrapeYupooDiscovery).mockResolvedValue({ categories: [], suppliers: [], pages: [] })
    vi.mocked(executeMissionDiscoveryStage).mockResolvedValue({
      mission_id: MISSION_ID,
      categories_count: 2,
      suppliers_count: 1,
    })

    const result = await runMissionDiscovery({ mission_id: MISSION_ID })

    expect(executeMissionDiscoveryStage).toHaveBeenCalledWith(expect.anything(), {
      mission_id: MISSION_ID,
    })
    expect(result).toEqual({
      data: { mission_id: MISSION_ID, categories_count: 2, suppliers_count: 1 },
      error: null,
    })
    expect(scrapeYupooDiscovery).not.toHaveBeenCalled()
    expect(extractDiscoveryFromHtml).not.toHaveBeenCalled()
  })

  it('surfaces stage failure as the scrape cause, never worker-config text', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockMissionLookup()
    vi.mocked(scrapeYupooDiscovery).mockResolvedValue({ categories: [], suppliers: [], pages: [] })
    vi.mocked(executeMissionDiscoveryStage).mockRejectedValue(
      new Error('Every Yupoo discovery request failed.'),
    )

    const result = await runMissionDiscovery({ mission_id: MISSION_ID })

    expect(result).toEqual({
      data: null,
      error: { message: 'Every Yupoo discovery request failed.' },
    })
    expect(result.error?.message ?? '').not.toMatch(/MISSION_WORKER_URL|MISSION_WORKER_TOKEN/)
  })
})

describe('runMissionDiscoveryWithFallback', () => {
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
  })

  it('enqueues when worker env is present', async () => {
    process.env.MISSION_WORKER_URL = 'http://localhost:3090/api/mission-worker'
    process.env.MISSION_WORKER_TOKEN = 'test-token'
    mockEnqueueMissionStage.mockResolvedValue({
      data: {
        mission_id: MISSION_ID,
        stage: 'discovery',
        status: 'discovery_queued',
        processor_invoked: true,
      },
      error: null,
    })

    const result = await runMissionDiscoveryWithFallback({ mission_id: MISSION_ID })

    expect(mockEnqueueMissionStage).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ mission_id: MISSION_ID, stage: 'discovery' }),
    )
    expect(enqueueMissionStage).toHaveBeenCalled()
    expect(executeMissionDiscoveryStage).not.toHaveBeenCalled()
    expect(result).toEqual({
      data: {
        mission_id: MISSION_ID,
        stage: 'discovery',
        status: 'discovery_queued',
        processor_invoked: true,
      },
      error: null,
    })
  })

  it('runs inline when worker env is absent', async () => {
    vi.mocked(executeMissionDiscoveryStage).mockResolvedValue({
      mission_id: MISSION_ID,
      categories_count: 1,
      suppliers_count: 0,
    })

    const result = await runMissionDiscoveryWithFallback({ mission_id: MISSION_ID })

    expect(executeMissionDiscoveryStage).toHaveBeenCalledWith(expect.anything(), {
      mission_id: MISSION_ID,
    })
    expect(mockEnqueueMissionStage).not.toHaveBeenCalled()
    expect(result).toEqual({
      data: { mission_id: MISSION_ID, categories_count: 1, suppliers_count: 0 },
      error: null,
    })
  })

  it('falls through to Direct when the queue processor was never invoked', async () => {
    process.env.MISSION_WORKER_URL = 'http://172.24.227.250:3090/api/mission-worker'
    process.env.MISSION_WORKER_TOKEN = 'your-local-secret'
    mockEnqueueMissionStage.mockResolvedValue({
      data: {
        mission_id: MISSION_ID,
        stage: 'discovery',
        status: 'discovery_queued',
        processor_invoked: false,
      },
      error: { message: 'MISSION_WORKER_URL and MISSION_WORKER_TOKEN must be configured before processing mission queue messages.' },
    })
    vi.mocked(executeMissionDiscoveryStage).mockResolvedValue({
      mission_id: MISSION_ID,
      categories_count: 1,
      suppliers_count: 0,
    })

    const result = await runMissionDiscoveryWithFallback({ mission_id: MISSION_ID })

    expect(mockEnqueueMissionStage).toHaveBeenCalled()
    expect(executeMissionDiscoveryStage).toHaveBeenCalledWith(expect.anything(), {
      mission_id: MISSION_ID,
    })
    expect(result).toEqual({
      data: { mission_id: MISSION_ID, categories_count: 1, suppliers_count: 0 },
      error: null,
    })
  })

  it('propagates the queue error when the processor was invoked', async () => {
    process.env.MISSION_WORKER_URL = 'http://localhost:3090/api/mission-worker'
    process.env.MISSION_WORKER_TOKEN = 'test-token'
    mockEnqueueMissionStage.mockResolvedValue({
      data: {
        mission_id: MISSION_ID,
        stage: 'discovery',
        status: 'discovery_queued',
        processor_invoked: true,
      },
      error: { message: 'Mission worker failed with 500: boom' },
    })

    const result = await runMissionDiscoveryWithFallback({ mission_id: MISSION_ID })

    expect(mockEnqueueMissionStage).toHaveBeenCalled()
    expect(executeMissionDiscoveryStage).not.toHaveBeenCalled()
    expect(result).toEqual({
      data: {
        mission_id: MISSION_ID,
        stage: 'discovery',
        status: 'discovery_queued',
        processor_invoked: true,
      },
      error: { message: 'Mission worker failed with 500: boom' },
    })
  })

  it('runs inline without touching the queue when MISSION_RUN_INLINE=true, even with worker env present', async () => {
    process.env.MISSION_RUN_INLINE = 'true'
    process.env.MISSION_WORKER_URL = 'http://localhost:3090/api/mission-worker'
    process.env.MISSION_WORKER_TOKEN = 'test-token'
    vi.mocked(executeMissionDiscoveryStage).mockResolvedValue({
      mission_id: MISSION_ID,
      categories_count: 3,
      suppliers_count: 1,
    })

    const result = await runMissionDiscoveryWithFallback({ mission_id: MISSION_ID })

    expect(executeMissionDiscoveryStage).toHaveBeenCalledWith(expect.anything(), {
      mission_id: MISSION_ID,
    })
    expect(mockEnqueueMissionStage).not.toHaveBeenCalled()
    expect(result).toEqual({
      data: { mission_id: MISSION_ID, categories_count: 3, suppliers_count: 1 },
      error: null,
    })
  })

  it('takes the enqueue path when MISSION_RUN_INLINE=false and worker env is present', async () => {
    process.env.MISSION_RUN_INLINE = 'false'
    process.env.MISSION_WORKER_URL = 'http://localhost:3090/api/mission-worker'
    process.env.MISSION_WORKER_TOKEN = 'test-token'
    mockEnqueueMissionStage.mockResolvedValue({
      data: {
        mission_id: MISSION_ID,
        stage: 'discovery',
        status: 'discovery_queued',
        processor_invoked: true,
      },
      error: null,
    })

    const result = await runMissionDiscoveryWithFallback({ mission_id: MISSION_ID })

    expect(mockEnqueueMissionStage).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ mission_id: MISSION_ID, stage: 'discovery' }),
    )
    expect(executeMissionDiscoveryStage).not.toHaveBeenCalled()
    expect(result.error).toBeNull()
  })

  it('defaults to inline in development when the flag is unset, even with worker env present', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    process.env.MISSION_WORKER_URL = 'http://localhost:3090/api/mission-worker'
    process.env.MISSION_WORKER_TOKEN = 'test-token'
    vi.mocked(executeMissionDiscoveryStage).mockResolvedValue({
      mission_id: MISSION_ID,
      categories_count: 1,
      suppliers_count: 0,
    })

    const result = await runMissionDiscoveryWithFallback({ mission_id: MISSION_ID })

    expect(executeMissionDiscoveryStage).toHaveBeenCalledWith(expect.anything(), {
      mission_id: MISSION_ID,
    })
    expect(mockEnqueueMissionStage).not.toHaveBeenCalled()
    expect(result.error).toBeNull()
  })

  it('defaults to the queue path outside development when the flag is unset and worker env is present', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    process.env.MISSION_WORKER_URL = 'http://localhost:3090/api/mission-worker'
    process.env.MISSION_WORKER_TOKEN = 'test-token'
    mockEnqueueMissionStage.mockResolvedValue({
      data: {
        mission_id: MISSION_ID,
        stage: 'discovery',
        status: 'discovery_queued',
        processor_invoked: true,
      },
      error: null,
    })

    const result = await runMissionDiscoveryWithFallback({ mission_id: MISSION_ID })

    expect(mockEnqueueMissionStage).toHaveBeenCalled()
    expect(executeMissionDiscoveryStage).not.toHaveBeenCalled()
    expect(result.error).toBeNull()
  })
})
