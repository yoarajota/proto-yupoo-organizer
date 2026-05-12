'use server'

import { revalidatePath } from 'next/cache'
import { enqueueMissionStage } from '@/lib/mission-queue'
import { createClient } from '@/lib/supabase/server'
import {
  RunMissionMatchingSchema,
  type RunMissionMatchingValues,
} from '@/lib/schemas/sourcing-matching'
import { rankSuppliersForMission } from '@/lib/yupoo/match'

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

  const startedAt = new Date().toISOString()

  const { error: missionStatusError } = await supabase
    .from('sourcing_missions')
    .update({ status: 'matching' })
    .eq('id', parsed.data.mission_id)

  if (missionStatusError) return { data: null, error: { message: missionStatusError.message } }

  const { error: stageInsertError } = await supabase
    .from('sourcing_mission_stage_metrics')
    .insert({
      mission_id: parsed.data.mission_id,
      stage_name: 'matching',
      started_at: startedAt,
    })

  if (stageInsertError) return { data: null, error: { message: stageInsertError.message } }

  const { data: mission, error: missionError } = await supabase
    .from('sourcing_missions')
    .select('id, product_intent')
    .eq('id', parsed.data.mission_id)
    .single()

  if (missionError) return { data: null, error: { message: missionError.message } }

  const { data: discoveredSuppliers, error: suppliersError } = await supabase
    .from('discovered_suppliers')
    .select('id, supplier_key, category_refs, normalized_category_refs, last_seen_at, confidence')
    .eq('mission_id', parsed.data.mission_id)

  if (suppliersError) return { data: null, error: { message: suppliersError.message } }

  const ranked = rankSuppliersForMission(
    mission.product_intent,
    discoveredSuppliers ?? [],
    startedAt,
  ).slice(0, parsed.data.shortlist_limit)

  if (ranked.length > 0) {
    const { error: upsertError } = await supabase
      .from('mission_supplier_matches')
      .upsert(
        ranked.map((entry) => ({
          mission_id: parsed.data.mission_id,
          supplier_id: entry.supplier_id,
          rank_score: entry.rank_score,
          rank_reasons: entry.rank_reasons,
        })),
        { onConflict: 'mission_id,supplier_id' },
      )

    if (upsertError) return { data: null, error: { message: upsertError.message } }
  }

  const finishedAt = new Date().toISOString()

  const { error: stageFinishError } = await supabase
    .from('sourcing_mission_stage_metrics')
    .update({ finished_at: finishedAt })
    .eq('mission_id', parsed.data.mission_id)
    .eq('stage_name', 'matching')
    .eq('started_at', startedAt)

  if (stageFinishError) return { data: null, error: { message: stageFinishError.message } }

  const { error: missionAdvanceError } = await supabase
    .from('sourcing_missions')
    .update({ status: 'suggestions_ready' })
    .eq('id', parsed.data.mission_id)

  if (missionAdvanceError) return { data: null, error: { message: missionAdvanceError.message } }

  revalidatePath('/workspace')

  return {
    data: {
      mission_id: parsed.data.mission_id,
      shortlisted_suppliers_count: ranked.length,
      top_rank_score: ranked[0]?.rank_score ?? null,
    },
    error: null,
  }
}
