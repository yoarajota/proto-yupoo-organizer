'use server'

import { revalidatePath } from 'next/cache'
import { executeMissionDiscoveryStage } from '@/lib/mission-stage-runner'
import { enqueueMissionStage } from '@/lib/mission-queue'
import { createClient } from '@/lib/supabase/server'
import {
  RunMissionDiscoverySchema,
  type RunMissionDiscoveryValues,
} from '@/lib/schemas/sourcing-discovery'

export async function runMissionDiscovery(input: RunMissionDiscoveryValues) {
  const parsed = RunMissionDiscoverySchema.safeParse(input)
  if (!parsed.success) return { data: null, error: { message: 'Invalid discovery payload.' } }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: { message: 'Unauthorized' } }

  const result = await enqueueMissionStage(supabase, {
    mission_id: parsed.data.mission_id,
    stage: 'discovery',
    payload: {
      seed_url: parsed.data.seed_url,
      html_snapshot: parsed.data.html_snapshot,
      requested_by: user.id,
    },
  })

  revalidatePath('/workspace')
  return result
}

export async function executeMissionDiscoveryDirect(input: RunMissionDiscoveryValues) {
  const parsed = RunMissionDiscoverySchema.safeParse(input)
  if (!parsed.success) return { data: null, error: { message: 'Invalid discovery payload.' } }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: { message: 'Unauthorized' } }

  try {
    const data = await executeMissionDiscoveryStage(supabase, parsed.data)
    revalidatePath('/workspace')
    return { data, error: null }
  } catch (error) {
    return {
      data: null,
      error: { message: error instanceof Error ? error.message : 'Discovery run failed.' },
    }
  }
}

function isMissionRunInline() {
  const raw = process.env.MISSION_RUN_INLINE?.trim().toLowerCase()
  if (raw === 'true') return true
  if (raw === 'false') return false
  return process.env.NODE_ENV === 'development'
}

function isMissionWorkerConfigured() {
  return Boolean(process.env.MISSION_WORKER_URL && process.env.MISSION_WORKER_TOKEN)
}

export async function runMissionDiscoveryWithFallback(input: RunMissionDiscoveryValues) {
  // The queue processor reports per-message stage failures as HTTP 200, so a
  // locally-broken worker is indistinguishable from success at enqueue time.
  // Inline mode therefore bypasses the queue entirely instead of probing it.
  if (isMissionRunInline()) {
    return executeMissionDiscoveryDirect(input)
  }
  if (isMissionWorkerConfigured()) {
    const queued = await runMissionDiscovery(input)
    if (queued.error && queued.data?.processor_invoked === false) {
      return executeMissionDiscoveryDirect(input)
    }
    return queued
  }
  return executeMissionDiscoveryDirect(input)
}
