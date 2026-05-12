'use server'

import { revalidatePath } from 'next/cache'
import { enqueueMissionStage } from '@/lib/mission-queue'
import { createClient } from '@/lib/supabase/server'
import {
  ApproveOutreachSuggestionSchema,
  ExportOutreachSuggestionSchema,
  GenerateOutreachSuggestionsSchema,
  type ApproveOutreachSuggestionValues,
  type ExportOutreachSuggestionValues,
  type GenerateOutreachSuggestionsValues,
} from '@/lib/schemas/sourcing-outreach'
import { buildOutreachMessage } from '@/lib/yupoo/outreach'

export async function generateOutreachSuggestions(input: GenerateOutreachSuggestionsValues) {
  const parsed = GenerateOutreachSuggestionsSchema.safeParse(input)
  if (!parsed.success) return { data: null, error: { message: 'Invalid outreach payload.' } }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: { message: 'Unauthorized' } }

  const result = await enqueueMissionStage(supabase, {
    mission_id: parsed.data.mission_id,
    stage: 'suggestion_generation',
    payload: {
      max_suggestions: parsed.data.max_suggestions,
      requested_by: user.id,
    },
  })

  revalidatePath('/workspace')
  return result
}

export async function executeOutreachSuggestionsDirect(input: GenerateOutreachSuggestionsValues) {
  const parsed = GenerateOutreachSuggestionsSchema.safeParse(input)
  if (!parsed.success) return { data: null, error: { message: 'Invalid outreach payload.' } }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: { message: 'Unauthorized' } }

  const startedAt = new Date().toISOString()

  const { error: stageInsertError } = await supabase
    .from('sourcing_mission_stage_metrics')
    .insert({
      mission_id: parsed.data.mission_id,
      stage_name: 'suggestion_generation',
      started_at: startedAt,
    })

  if (stageInsertError) return { data: null, error: { message: stageInsertError.message } }

  const { data: mission, error: missionError } = await supabase
    .from('sourcing_missions')
    .select('id, product_intent, destination_context, constraints')
    .eq('id', parsed.data.mission_id)
    .single()

  if (missionError) return { data: null, error: { message: missionError.message } }

  const { data: matches, error: matchesError } = await supabase
    .from('mission_supplier_matches')
    .select('supplier_id, rank_score')
    .eq('mission_id', parsed.data.mission_id)
    .order('rank_score', { ascending: false })

  if (matchesError) return { data: null, error: { message: matchesError.message } }

  const shortlist = (matches ?? []).slice(0, parsed.data.max_suggestions)
  const supplierIds = shortlist.map((item) => item.supplier_id)

  let suppliers: Array<{ id: string; supplier_key: string }> = []
  if (supplierIds.length > 0) {
    const { data: rows, error: suppliersError } = await supabase
      .from('discovered_suppliers')
      .select('id, supplier_key')
      .in('id', supplierIds)

    if (suppliersError) return { data: null, error: { message: suppliersError.message } }
    suppliers = rows ?? []
  }

  const supplierLookup = new Map(suppliers.map((supplier) => [supplier.id, supplier]))

  const suggestions = shortlist
    .map((match) => {
      const supplier = supplierLookup.get(match.supplier_id)
      if (!supplier) return null

      const messageText = buildOutreachMessage({
        productIntent: mission.product_intent,
        destinationContext: mission.destination_context,
        constraints: mission.constraints as Record<string, unknown> | null,
        supplierKey: supplier.supplier_key,
      })

      return {
        mission_id: parsed.data.mission_id,
        supplier_id: supplier.id,
        channel_hint: 'whatsapp',
        language: 'en',
        message_text: messageText,
        status: 'pending_approval' as const,
      }
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)

  if (suggestions.length > 0) {
    const { error: upsertError } = await supabase
      .from('outreach_suggestions')
      .upsert(suggestions, { onConflict: 'mission_id,supplier_id' })

    if (upsertError) return { data: null, error: { message: upsertError.message } }
  }

  const finishedAt = new Date().toISOString()

  const { error: stageFinishError } = await supabase
    .from('sourcing_mission_stage_metrics')
    .update({ finished_at: finishedAt })
    .eq('mission_id', parsed.data.mission_id)
    .eq('stage_name', 'suggestion_generation')
    .eq('started_at', startedAt)

  if (stageFinishError) return { data: null, error: { message: stageFinishError.message } }

  const { error: missionUpdateError } = await supabase
    .from('sourcing_missions')
    .update({ status: 'awaiting_approval', first_suggestion_batch_at: finishedAt })
    .eq('id', parsed.data.mission_id)

  if (missionUpdateError) return { data: null, error: { message: missionUpdateError.message } }

  revalidatePath('/workspace')

  return {
    data: {
      mission_id: parsed.data.mission_id,
      suggestions_count: suggestions.length,
    },
    error: null,
  }
}

export async function approveOutreachSuggestion(input: ApproveOutreachSuggestionValues) {
  const parsed = ApproveOutreachSuggestionSchema.safeParse(input)
  if (!parsed.success) return { data: null, error: { message: 'Invalid approval payload.' } }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: { message: 'Unauthorized' } }

  const approvedAt = new Date().toISOString()
  const { data, error } = await supabase
    .from('outreach_suggestions')
    .update({ status: 'approved', approved_by: user.id, approved_at: approvedAt })
    .eq('id', parsed.data.suggestion_id)
    .select()
    .single()

  if (error) return { data: null, error: { message: error.message } }

  revalidatePath('/workspace')
  return { data, error: null }
}

export async function exportOutreachSuggestion(input: ExportOutreachSuggestionValues) {
  const parsed = ExportOutreachSuggestionSchema.safeParse(input)
  if (!parsed.success) return { data: null, error: { message: 'Invalid export payload.' } }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: { message: 'Unauthorized' } }

  const exportedAt = new Date().toISOString()
  const { data, error } = await supabase
    .from('outreach_suggestions')
    .update({ status: 'exported', exported_at: exportedAt })
    .eq('id', parsed.data.suggestion_id)
    .eq('status', 'approved')
    .select()
    .single()

  if (error) return { data: null, error: { message: error.message } }

  revalidatePath('/workspace')
  return { data, error: null }
}
