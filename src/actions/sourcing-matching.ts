'use server'

import { revalidatePath } from 'next/cache'
import { enqueueMissionStage } from '@/lib/mission-queue'
import { createClient } from '@/lib/supabase/server'
import {
  RunMissionMatchingSchema,
  type RunMissionMatchingValues,
} from '@/lib/schemas/sourcing-matching'
import { executeMissionMatchingStage } from '@/lib/mission-stage-runner'

export async function runMissionMatching(input: RunMissionMatchingValues) {
  const parsed = RunMissionMatchingSchema.safeParse(input)
  if (!parsed.success) return { data: null, error: { message: 'Invalid matching payload.' } }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: { message: 'Unauthorized' } }

  const result = await enqueueMissionStage(supabase, {
    mission_id: parsed.data.mission_id,
    stage: 'matching',
    payload: {
      shortlist_limit: parsed.data.shortlist_limit,
      requested_by: user.id,
    },
  })

  revalidatePath('/workspace')
  return result
}

export async function executeMissionMatchingDirect(input: RunMissionMatchingValues) {
  const parsed = RunMissionMatchingSchema.safeParse(input)
  if (!parsed.success) return { data: null, error: { message: 'Invalid matching payload.' } }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: { message: 'Unauthorized' } }

  try {
    const data = await executeMissionMatchingStage(supabase, parsed.data)
    revalidatePath('/workspace')
    return { data, error: null }
  } catch (error) {
    return { data: null, error: { message: error instanceof Error ? error.message : 'Matching failed.' } }
  }
}
