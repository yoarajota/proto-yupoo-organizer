import { describe, expect, it, vi } from 'vitest'
import { enqueueMissionStage } from './mission-queue'

function makeSupabaseMock() {
  const missionUpdate = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: null }),
  })
  const runInsert = vi.fn().mockResolvedValue({ error: null })
  const queueSend = vi.fn().mockResolvedValue({ data: 42, error: null })
  const invoke = vi.fn().mockResolvedValue({ data: {}, error: null })

  return {
    supabase: {
      from: vi.fn((table: string) => {
        if (table === 'sourcing_missions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: '550e8400-e29b-41d4-a716-446655440000', status: 'created', attempt_count: 0 },
                  error: null,
                }),
              }),
            }),
            update: missionUpdate,
          }
        }

        if (table === 'sourcing_mission_runs') {
          return { insert: runInsert }
        }

        return {}
      }),
      rpc: queueSend,
      functions: {
        invoke,
      },
    },
    missionUpdate,
    runInsert,
    queueSend,
    invoke,
  }
}

describe('enqueueMissionStage', () => {
  it('validates queue payloads', async () => {
    const { supabase } = makeSupabaseMock()

    const result = await enqueueMissionStage(supabase as never, {
      mission_id: 'bad-id',
      stage: 'discovery',
      payload: {},
    } as never)

    expect(result).toEqual({ data: null, error: { message: 'Invalid mission queue payload.' } })
  })

  it('sends a durable queue message, updates mission metadata, and invokes processor', async () => {
    const { supabase, missionUpdate, queueSend, runInsert, invoke } = makeSupabaseMock()

    const result = await enqueueMissionStage(supabase as never, {
      mission_id: '550e8400-e29b-41d4-a716-446655440000',
      stage: 'discovery',
      payload: { seed_url: 'https://shop.x.yupoo.com/' },
    })

    expect(result.error).toBeNull()
    expect(result.data).toMatchObject({
      mission_id: '550e8400-e29b-41d4-a716-446655440000',
      stage: 'discovery',
      status: 'discovery_queued',
      processor_invoked: true,
    })
    expect(queueSend).toHaveBeenCalledWith('mission_queue_send', {
      queue_name: 'mission_runs',
      message: expect.objectContaining({
        mission_id: '550e8400-e29b-41d4-a716-446655440000',
        stage: 'discovery',
        payload: { seed_url: 'https://shop.x.yupoo.com/' },
      }),
      sleep_seconds: 0,
    })
    expect(missionUpdate).toHaveBeenCalledWith(expect.objectContaining({
      status: 'discovery_queued',
      current_stage: 'discovery',
      last_queue_message_id: '42',
    }))
    expect(runInsert).toHaveBeenCalledWith(expect.objectContaining({
      mission_id: '550e8400-e29b-41d4-a716-446655440000',
      stage_name: 'discovery',
      status: 'queued',
      queue_message_id: '42',
    }))
    expect(invoke).toHaveBeenCalledWith('mission-queue', {
      body: { source: 'server-action' },
    })
  })

  it('allows the classification stage but still blocks later workflow stages', async () => {
    const { supabase, missionUpdate } = makeSupabaseMock()

    const classificationResult = await enqueueMissionStage(supabase as never, {
      mission_id: '550e8400-e29b-41d4-a716-446655440000',
      stage: 'classifying_categories',
      payload: {},
    })

    expect(classificationResult.error).toBeNull()
    expect(classificationResult.data).toMatchObject({
      stage: 'classifying_categories',
      status: 'classification_queued',
    })
    expect(missionUpdate).toHaveBeenCalledWith(expect.objectContaining({
      status: 'classification_queued',
      current_stage: 'classifying_categories',
    }))

    const matchingResult = await enqueueMissionStage(supabase as never, {
      mission_id: '550e8400-e29b-41d4-a716-446655440000',
      stage: 'matching',
      payload: {},
    })

    expect(matchingResult).toEqual({
      data: null,
      error: { message: 'Only scrape discovery and classification missions are supported.' },
    })
  })
})
