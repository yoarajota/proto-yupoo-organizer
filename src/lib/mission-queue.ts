import { z } from 'zod'
import { MissionStageSchema, missionStageQueuedStatus } from '@/lib/mission-status'
import type { createClient } from '@/lib/supabase/server'
import type { Json } from '@/types/database'

const DEFAULT_QUEUE_NAME = 'mission_runs'

export const EnqueueMissionStageSchema = z.object({
  mission_id: z.string().uuid(),
  stage: MissionStageSchema,
  payload: z.record(z.string(), z.unknown()).default({}),
})

export type EnqueueMissionStageValues = z.infer<typeof EnqueueMissionStageSchema>

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

function getProcessorFunctionName() {
  return process.env.SUPABASE_MISSION_PROCESSOR_FUNCTION ?? 'mission-queue'
}

export async function invokeMissionProcessor(supabase: SupabaseServerClient) {
  if (!('functions' in supabase) || !supabase.functions) return null

  const { error } = await supabase.functions.invoke(getProcessorFunctionName(), {
    body: { source: 'server-action' },
  })

  if (error) throw new Error(error.message)
  return true
}

export async function enqueueMissionStage(
  supabase: SupabaseServerClient,
  input: EnqueueMissionStageValues,
) {
  const parsed = EnqueueMissionStageSchema.safeParse(input)
  if (!parsed.success) return { data: null, error: { message: 'Invalid mission queue payload.' } }
  if (parsed.data.stage !== 'discovery' && parsed.data.stage !== 'classifying_categories') {
    return { data: null, error: { message: 'Only scrape discovery and classification missions are supported.' } }
  }

  const { data: mission, error: missionError } = await supabase
    .from('sourcing_missions')
    .select('id, status, attempt_count')
    .eq('id', parsed.data.mission_id)
    .single()

  if (missionError) return { data: null, error: { message: missionError.message } }

  const queuedAt = new Date().toISOString()
  const queuedStatus = missionStageQueuedStatus[parsed.data.stage]
  const nextAttempt = Number(mission?.attempt_count ?? 0) + 1
  const message = {
    mission_id: parsed.data.mission_id,
    stage: parsed.data.stage,
    attempt: nextAttempt,
    enqueued_at: queuedAt,
    payload: parsed.data.payload,
  }

  const queueRpcClient = supabase as unknown as {
    rpc: (
      fn: 'mission_queue_send',
      args: {
        queue_name: string
        message: Json
        sleep_seconds: number
      },
    ) => Promise<{ data: unknown; error: { message: string } | null }>
  }

  const { data: queueResult, error: queueError } = await queueRpcClient.rpc('mission_queue_send', {
      queue_name: DEFAULT_QUEUE_NAME,
      message: message as Json,
      sleep_seconds: 0,
    })

  if (queueError) return { data: null, error: { message: queueError.message } }

  const queueMessageId = Array.isArray(queueResult) ? queueResult[0] : queueResult

  const { error: updateError } = await supabase
    .from('sourcing_missions')
    .update({
      status: queuedStatus,
      current_stage: parsed.data.stage,
      queued_at: queuedAt,
      running_at: null,
      failed_at: null,
      attempt_count: nextAttempt,
      last_error_message: null,
      last_error_code: null,
      last_queue_message_id: queueMessageId === null || queueMessageId === undefined
        ? null
        : String(queueMessageId),
    })
    .eq('id', parsed.data.mission_id)

  if (updateError) return { data: null, error: { message: updateError.message } }

  const { error: runInsertError } = await supabase
    .from('sourcing_mission_runs')
    .insert({
      mission_id: parsed.data.mission_id,
      stage_name: parsed.data.stage,
      status: 'queued',
      attempt_number: nextAttempt,
      queue_message_id: queueMessageId === null || queueMessageId === undefined
        ? null
        : String(queueMessageId),
      queued_at: queuedAt,
      diagnostics: message.payload as Json,
    })

  if (runInsertError) return { data: null, error: { message: runInsertError.message } }

  try {
    await invokeMissionProcessor(supabase)
  } catch (error) {
    return {
      data: {
        mission_id: parsed.data.mission_id,
        stage: parsed.data.stage,
        status: queuedStatus,
        processor_invoked: false,
      },
      error: {
        message: error instanceof Error ? error.message : 'Mission queued, but processor invocation failed.',
      },
    }
  }

  return {
    data: {
      mission_id: parsed.data.mission_id,
      stage: parsed.data.stage,
      status: queuedStatus,
      processor_invoked: true,
    },
    error: null,
  }
}
