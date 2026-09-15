import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const queueName = 'mission_runs'
const batchSize = Number(Deno.env.get('MISSION_QUEUE_BATCH_SIZE') ?? '5')
const workerTimeoutMs = Number(Deno.env.get('MISSION_WORKER_TIMEOUT_MS') ?? '120000')

type MissionStage =
  | 'discovery'
  | 'classifying_categories'
  | 'matching'
  | 'suggestion_generation'
  | 'parse'

type QueueMessage = {
  msg_id: number | string
  read_ct: number
  enqueued_at: string
  vt: string
  message: {
    mission_id?: string
    stage?: MissionStage
    attempt?: number
    payload?: Record<string, unknown>
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function getRunningStatus(stage: MissionStage) {
  if (stage === 'discovery') return 'scanning'
  if (stage === 'suggestion_generation') return 'suggestions_ready'
  if (stage === 'parse') return 'replies_received'
  return stage
}

async function recordEvent(
  supabase: ReturnType<typeof createClient>,
  input: {
    missionId: string
    runId?: string | null
    stage: MissionStage
    eventName: string
    diagnostics?: Record<string, unknown>
  },
) {
  await supabase.from('sourcing_mission_stage_events').insert({
    mission_id: input.missionId,
    run_id: input.runId ?? null,
    stage_name: input.stage,
    event_name: input.eventName,
    diagnostics: input.diagnostics ?? {},
  })
}

async function dispatchMissionStage(stage: MissionStage, payload: Record<string, unknown>) {
  const workerUrl = Deno.env.get('MISSION_WORKER_URL')
  const workerToken = Deno.env.get('MISSION_WORKER_TOKEN')

  if (!workerUrl || !workerToken) {
    throw new Error('MISSION_WORKER_URL and MISSION_WORKER_TOKEN must be configured before processing mission queue messages.')
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), workerTimeoutMs)

  let response: Response
  try {
    response = await fetch(workerUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${workerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ stage, payload }),
      signal: controller.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`Mission worker timed out after ${workerTimeoutMs}ms.`)
    }

    throw error
  } finally {
    clearTimeout(timeout)
  }

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Mission worker failed with ${response.status}: ${body.slice(0, 500)}`)
  }

  const contentType = response.headers.get('content-type') ?? ''
  const body = await response.text()

  if (!contentType.includes('application/json')) {
    throw new Error(`Mission worker returned non-JSON response with ${response.status}: ${body.slice(0, 500)}`)
  }

  try {
    return JSON.parse(body)
  } catch {
    throw new Error(`Mission worker returned invalid JSON with ${response.status}: ${body.slice(0, 500)}`)
  }
}

async function deleteQueueMessage(
  supabase: ReturnType<typeof createClient>,
  queueMessage: QueueMessage,
) {
  const { error } = await supabase.rpc('mission_queue_delete', {
    queue_name: queueName,
    msg_id: Number(queueMessage.msg_id),
  })

  if (error) throw new Error(error.message)
}

async function processMessage(
  supabase: ReturnType<typeof createClient>,
  queueMessage: QueueMessage,
) {
  const missionId = queueMessage.message?.mission_id
  const stage = queueMessage.message?.stage
  const attempt = Number(queueMessage.message?.attempt ?? queueMessage.read_ct ?? 1)
  const payload = queueMessage.message?.payload ?? {}
  const startedAt = new Date().toISOString()

  if (!missionId || !stage) {
    throw new Error('Mission queue message is missing mission_id or stage.')
  }

  const { data: mission, error: missionLookupError } = await supabase
    .from('sourcing_missions')
    .select('id')
    .eq('id', missionId)
    .maybeSingle()

  if (missionLookupError) throw new Error(missionLookupError.message)

  if (!mission) {
    console.warn('Mission queue message skipped because mission was deleted', {
      mission_id: missionId,
      queue_message_id: String(queueMessage.msg_id),
      stage,
    })
    await deleteQueueMessage(supabase, queueMessage)
    return { ok: true, skipped: true, reason: 'mission_deleted' }
  }

  const { data: runRows, error: runLookupError } = await supabase
    .from('sourcing_mission_runs')
    .select('id')
    .eq('mission_id', missionId)
    .eq('queue_message_id', String(queueMessage.msg_id))
    .order('created_at', { ascending: false })
    .limit(1)

  if (runLookupError) throw new Error(runLookupError.message)

  const runId = runRows?.[0]?.id ?? null

  await supabase
    .from('sourcing_missions')
    .update({
      status: getRunningStatus(stage),
      current_stage: stage,
      running_at: startedAt,
      failed_at: null,
      attempt_count: attempt,
      last_error_message: null,
      last_error_code: null,
    })
    .eq('id', missionId)

  if (runId) {
    await supabase
      .from('sourcing_mission_runs')
      .update({
        status: 'running',
        started_at: startedAt,
      })
      .eq('id', runId)
  }

  await recordEvent(supabase, {
    missionId,
    runId,
    stage,
    eventName: 'started',
    diagnostics: { queue_message_id: String(queueMessage.msg_id), read_count: queueMessage.read_ct },
  })

  try {
    await recordEvent(supabase, {
      missionId,
      runId,
      stage,
      eventName: 'worker_dispatch_started',
      diagnostics: { worker_timeout_ms: workerTimeoutMs },
    })

    const diagnostics = await dispatchMissionStage(stage, {
      ...payload,
      mission_id: missionId,
      attempt,
      run_id: runId,
    })
    const finishedAt = new Date().toISOString()

    if (runId) {
      await supabase
        .from('sourcing_mission_runs')
        .update({
          status: 'succeeded',
          finished_at: finishedAt,
          diagnostics,
        })
        .eq('id', runId)
    }

    await recordEvent(supabase, {
      missionId,
      runId,
      stage,
      eventName: 'worker_dispatch_succeeded',
      diagnostics,
    })

    await recordEvent(supabase, {
      missionId,
      runId,
      stage,
      eventName: 'succeeded',
      diagnostics,
    })

    await deleteQueueMessage(supabase, queueMessage)
    return { ok: true }
  } catch (error) {
    const failedAt = new Date().toISOString()
    const message = error instanceof Error ? error.message : 'Mission stage failed.'

    await supabase
      .from('sourcing_missions')
      .update({
        status: 'failed_retrying',
        failed_at: failedAt,
        last_error_message: message,
        last_error_code: 'mission_stage_failed',
      })
      .eq('id', missionId)

    if (runId) {
      await supabase
        .from('sourcing_mission_runs')
        .update({
          status: 'failed',
          finished_at: failedAt,
          error_message: message,
          error_code: 'mission_stage_failed',
        })
        .eq('id', runId)
    }

    await recordEvent(supabase, {
      missionId,
      runId,
      stage,
      eventName: 'failed',
      diagnostics: { message },
    })

    throw error
  }
}

Deno.serve(async () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Supabase service credentials are not configured.' }, 500)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const { data: messages, error } = await supabase.rpc('mission_queue_read', {
    queue_name: queueName,
    sleep_seconds: 0,
    n: batchSize,
  })

  if (error) return jsonResponse({ error: error.message }, 500)

  let succeeded = 0
  let failed = 0

  for (const message of (messages ?? []) as QueueMessage[]) {
    try {
      await processMessage(supabase, message)
      succeeded += 1
    } catch (error) {
      console.error('Mission queue message failed', error)
      failed += 1
    }
  }

  return jsonResponse({
    processed: succeeded + failed,
    succeeded,
    failed,
  })
})
