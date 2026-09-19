'use server'

import { revalidatePath } from 'next/cache'
import { enqueueMissionStage } from '@/lib/mission-queue'
import { createClient } from '@/lib/supabase/server'
import {
  IngestInboundMessageSchema,
  ParseInboundOffersSchema,
  type IngestInboundMessageValues,
  type ParseInboundOffersValues,
} from '@/lib/schemas/sourcing-inbound'
import { parseInboundMessage } from '@/lib/yupoo/inbound'

export async function ingestInboundMessage(input: IngestInboundMessageValues) {
  const parsed = IngestInboundMessageSchema.safeParse(input)
  if (!parsed.success) return { data: null, error: { message: 'Invalid inbound payload.' } }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: { message: 'Unauthorized' } }

  const { data, error } = await supabase
    .from('supplier_messages')
    .insert({
      mission_id: parsed.data.mission_id,
      supplier_id: parsed.data.supplier_id,
      direction: 'inbound',
      channel: parsed.data.channel,
      body: parsed.data.body,
      received_or_sent_at: parsed.data.received_at ?? new Date().toISOString(),
    })
    .select()
    .single()

  if (error) return { data: null, error: { message: error.message } }

  revalidatePath('/workspace')
  return { data, error: null }
}

export async function parseInboundOffers(input: ParseInboundOffersValues) {
  const parsed = ParseInboundOffersSchema.safeParse(input)
  if (!parsed.success) return { data: null, error: { message: 'Invalid parse payload.' } }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: { message: 'Unauthorized' } }

  const result = await enqueueMissionStage(supabase, {
    mission_id: parsed.data.mission_id,
    stage: 'parse',
    payload: {
      max_messages: parsed.data.max_messages,
      requested_by: user.id,
    },
  })

  revalidatePath('/workspace')
  return result
}

export async function executeInboundOfferParsingDirect(input: ParseInboundOffersValues) {
  const parsed = ParseInboundOffersSchema.safeParse(input)
  if (!parsed.success) return { data: null, error: { message: 'Invalid parse payload.' } }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: { message: 'Unauthorized' } }

  const startedAt = new Date().toISOString()

  const { error: statusUpdateError } = await supabase
    .from('sourcing_missions')
    .update({ status: 'replies_received' })
    .eq('id', parsed.data.mission_id)

  if (statusUpdateError) return { data: null, error: { message: statusUpdateError.message } }

  const { error: stageInsertError } = await supabase
    .from('sourcing_mission_stage_metrics')
    .insert({
      mission_id: parsed.data.mission_id,
      stage_name: 'parse',
      started_at: startedAt,
    })

  if (stageInsertError) return { data: null, error: { message: stageInsertError.message } }

  const { data: messages, error: messagesError } = await supabase
    .from('supplier_messages')
    .select('id, supplier_id, body, received_or_sent_at')
    .eq('mission_id', parsed.data.mission_id)
    .eq('direction', 'inbound')
    .order('received_or_sent_at', { ascending: false })
    .limit(parsed.data.max_messages)

  if (messagesError) return { data: null, error: { message: messagesError.message } }

  const parsedMessages = (messages ?? []).map((message) => ({
    supplier_id: message.supplier_id,
    parsed: parseInboundMessage(message.body),
    received_or_sent_at: message.received_or_sent_at,
  }))

  const offers = parsedMessages
    .filter((entry) => entry.parsed.unitPrice !== null || entry.parsed.moq !== null || entry.parsed.leadTime !== null)
    .map((entry) => ({
      mission_id: parsed.data.mission_id,
      supplier_id: entry.supplier_id,
      unit_price: entry.parsed.unitPrice,
      currency: entry.parsed.currency,
      moq: entry.parsed.moq,
      lead_time: entry.parsed.leadTime,
      terms_notes: entry.parsed.termsNotes,
      extraction_confidence: entry.parsed.extractionConfidence,
      extracted_at: entry.received_or_sent_at,
    }))

  if (offers.length > 0) {
    const { error: offersError } = await supabase
      .from('normalized_offers')
      .upsert(offers, { onConflict: 'mission_id,supplier_id' })

    if (offersError) return { data: null, error: { message: offersError.message } }
  }

  const catalogueSummaries = parsedMessages
    .filter((entry) => entry.parsed.catalogueSummary !== null)
    .map((entry) => ({
      mission_id: parsed.data.mission_id,
      supplier_id: entry.supplier_id,
      catalogue_received_at: entry.received_or_sent_at,
      summary_text: entry.parsed.catalogueSummary as string,
      summary_confidence: entry.parsed.extractionConfidence,
    }))

  if (catalogueSummaries.length > 0) {
    const { error: catalogueError } = await supabase
      .from('catalogue_summaries')
      .upsert(catalogueSummaries, { onConflict: 'mission_id,supplier_id' })

    if (catalogueError) return { data: null, error: { message: catalogueError.message } }
  }

  const finishedAt = new Date().toISOString()

  const { error: stageFinishError } = await supabase
    .from('sourcing_mission_stage_metrics')
    .update({ finished_at: finishedAt })
    .eq('mission_id', parsed.data.mission_id)
    .eq('stage_name', 'parse')
    .eq('started_at', startedAt)

  if (stageFinishError) return { data: null, error: { message: stageFinishError.message } }

  const hasValidQuote = offers.some((offer) => offer.unit_price !== null)
  const missionUpdate = hasValidQuote
    ? { status: 'offers_normalized' as const, first_valid_quote_at: finishedAt }
    : { status: 'offers_normalized' as const }

  const { error: finalMissionError } = await supabase
    .from('sourcing_missions')
    .update(missionUpdate)
    .eq('id', parsed.data.mission_id)

  if (finalMissionError) return { data: null, error: { message: finalMissionError.message } }

  revalidatePath('/workspace')

  return {
    data: {
      mission_id: parsed.data.mission_id,
      offers_count: offers.length,
      catalogue_summaries_count: catalogueSummaries.length,
    },
    error: null,
  }
}
