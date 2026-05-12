'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  CreateSourcingMissionSchema,
  DeleteSourcingMissionSchema,
  UpdateSourcingMissionStatusSchema,
  type CreateSourcingMissionValues,
  type SourcingMissionStatus,
} from '@/lib/schemas/sourcing-mission'
import type { Json } from '@/types/database'

export async function createSourcingMission(formData: CreateSourcingMissionValues) {
  const parsed = CreateSourcingMissionSchema.safeParse(formData)
  if (!parsed.success) return { data: null, error: { message: 'Invalid mission data.' } }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: { message: 'Unauthorized' } }

  const seedHost = new URL(parsed.data.seed_url).hostname
  const productIntent = parsed.data.product_intent?.trim() || `Yupoo scrape: ${seedHost}`

  const { data, error } = await supabase
    .from('sourcing_missions')
    .insert({
      created_by: user.id,
      product_intent: productIntent,
      seed_url: parsed.data.seed_url,
      destination_context: parsed.data.destination_context ?? null,
      constraints: (parsed.data.constraints ?? {}) as Json,
      objective: 'speed',
      status: 'created',
    })
    .select()
    .single()

  if (error) return { data: null, error: { message: error.message } }
  revalidatePath('/workspace')
  return { data, error: null }
}

export async function updateSourcingMissionStatus(missionId: string, status: SourcingMissionStatus) {
  const parsed = UpdateSourcingMissionStatusSchema.safeParse({ status })
  if (!parsed.success) return { data: null, error: { message: 'Invalid mission status.' } }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: { message: 'Unauthorized' } }

  const { data, error } = await supabase
    .from('sourcing_missions')
    .update({ status: parsed.data.status })
    .eq('id', missionId)
    .select()
    .single()

  if (error) return { data: null, error: { message: error.message } }
  revalidatePath('/workspace')
  return { data, error: null }
}

export async function deleteSourcingMission(missionId: string) {
  const parsed = DeleteSourcingMissionSchema.safeParse({ mission_id: missionId })
  if (!parsed.success) return { data: null, error: { message: 'Invalid mission id.' } }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: { message: 'Unauthorized' } }

  const { data, error } = await supabase
    .from('sourcing_missions')
    .delete()
    .eq('id', parsed.data.mission_id)
    .select('id')
    .single()

  if (error) return { data: null, error: { message: error.message } }

  revalidatePath('/workspace')
  revalidatePath('/workspace/missions')
  revalidatePath(`/missions/${parsed.data.mission_id}`)

  return { data, error: null }
}

export async function getSourcingMissionMetrics(missionId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: { message: 'Unauthorized' } }

  const { data: mission, error: missionError } = await supabase
    .from('sourcing_missions')
    .select('id, created_at, first_suggestion_batch_at, first_valid_quote_at, status')
    .eq('id', missionId)
    .single()

  if (missionError) return { data: null, error: { message: missionError.message } }

  const { data: stageMetrics, error: stageMetricsError } = await supabase
    .from('sourcing_mission_stage_metrics')
    .select('stage_name, started_at, finished_at, duration_ms')
    .eq('mission_id', missionId)
    .order('started_at', { ascending: true })

  if (stageMetricsError) return { data: null, error: { message: stageMetricsError.message } }

  return {
    data: {
      mission,
      stage_metrics: stageMetrics ?? [],
    },
    error: null,
  }
}
