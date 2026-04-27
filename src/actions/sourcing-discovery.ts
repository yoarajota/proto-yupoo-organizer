'use server'

import { revalidatePath } from 'next/cache'
import { writeAgentRunArtifact } from '@/lib/agent-logs'
import { createClient } from '@/lib/supabase/server'
import {
  RunMissionDiscoverySchema,
  type RunMissionDiscoveryValues,
} from '@/lib/schemas/sourcing-discovery'
import { crawlYupooDiscovery, extractDiscoveryFromHtml } from '@/lib/yupoo/scout'

export async function runMissionDiscovery(input: RunMissionDiscoveryValues) {
  const parsed = RunMissionDiscoverySchema.safeParse(input)
  if (!parsed.success) return { data: null, error: { message: 'Invalid discovery payload.' } }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: { message: 'Unauthorized' } }

  const startedAt = new Date().toISOString()

  const { error: missionUpdateError } = await supabase
    .from('sourcing_missions')
    .update({ status: 'scanning' })
    .eq('id', parsed.data.mission_id)

  if (missionUpdateError) return { data: null, error: { message: missionUpdateError.message } }

  const { error: stageInsertError } = await supabase
    .from('sourcing_mission_stage_metrics')
    .insert({
      mission_id: parsed.data.mission_id,
      stage_name: 'discovery',
      started_at: startedAt,
    })

  if (stageInsertError) return { data: null, error: { message: stageInsertError.message } }

  const { data: mission, error: missionError } = await supabase
    .from('sourcing_missions')
    .select('id, seed_url')
    .eq('id', parsed.data.mission_id)
    .single()

  if (missionError) return { data: null, error: { message: missionError.message } }

  const seedUrl = parsed.data.seed_url ?? mission.seed_url

  const discovered = parsed.data.html_snapshot
    ? extractDiscoveryFromHtml(parsed.data.html_snapshot, seedUrl, startedAt)
    : await crawlYupooDiscovery(seedUrl)

  const finishedAt = new Date().toISOString()

  try {
    await writeAgentRunArtifact('scouting', parsed.data.mission_id, startedAt, {
      finished_at: finishedAt,
      seed_url: seedUrl,
      used_html_snapshot: Boolean(parsed.data.html_snapshot),
      categories_count: discovered.categories.length,
      suppliers_count: discovered.suppliers.length,
      categories: discovered.categories,
      suppliers: discovered.suppliers,
    })
  } catch (error) {
    console.error('Failed to write scouting artifact', error)
  }

  if (discovered.categories.length > 0) {
    const { error: categoriesError } = await supabase
      .from('discovered_categories')
      .upsert(
        discovered.categories.map((category) => ({
          mission_id: parsed.data.mission_id,
          source_url: category.source_url,
          category_path: category.category_path,
          raw_label: category.raw_label,
          extracted_at: category.extracted_at,
          confidence: category.confidence,
        })),
        { onConflict: 'mission_id,source_url,category_path' },
      )

    if (categoriesError) return { data: null, error: { message: categoriesError.message } }
  }

  if (discovered.suppliers.length > 0) {
    const { error: suppliersError } = await supabase
      .from('discovered_suppliers')
      .upsert(
        discovered.suppliers.map((supplier) => ({
          mission_id: parsed.data.mission_id,
          supplier_key: supplier.supplier_key,
          source_url: supplier.source_url,
          category_refs: supplier.category_refs,
          normalized_category_refs: supplier.normalized_category_refs,
          last_seen_at: supplier.last_seen_at,
          confidence: supplier.confidence,
        })),
        { onConflict: 'mission_id,supplier_key,source_url' },
      )

    if (suppliersError) return { data: null, error: { message: suppliersError.message } }
  }

  const { error: stageFinishError } = await supabase
    .from('sourcing_mission_stage_metrics')
    .update({ finished_at: finishedAt })
    .eq('mission_id', parsed.data.mission_id)
    .eq('stage_name', 'discovery')
    .eq('started_at', startedAt)

  if (stageFinishError) return { data: null, error: { message: stageFinishError.message } }

  const { error: missionAdvanceError } = await supabase
    .from('sourcing_missions')
    .update({ status: 'classifying_categories' })
    .eq('id', parsed.data.mission_id)

  if (missionAdvanceError) return { data: null, error: { message: missionAdvanceError.message } }

  revalidatePath('/workspace')

  return {
    data: {
      mission_id: parsed.data.mission_id,
      categories_count: discovered.categories.length,
      suppliers_count: discovered.suppliers.length,
    },
    error: null,
  }
}
