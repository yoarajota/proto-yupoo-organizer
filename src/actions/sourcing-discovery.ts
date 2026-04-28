'use server'

import { revalidatePath } from 'next/cache'
import { writeAgentRunArtifact } from '@/lib/agent-logs'
import { createClient } from '@/lib/supabase/server'
import {
  RunMissionDiscoverySchema,
  type RunMissionDiscoveryValues,
} from '@/lib/schemas/sourcing-discovery'
import { extractDiscoveryFromHtml, scrapeYupooDiscovery } from '@/lib/yupoo/scout'

async function pruneMissingDiscoveredCategories(
  supabase: Awaited<ReturnType<typeof createClient>>,
  missionId: string,
  categories: Awaited<ReturnType<typeof scrapeYupooDiscovery>>['categories'],
) {
  const { data: existingCategories, error: existingCategoriesError } = await supabase
    .from('discovered_categories')
    .select('id, source_url, category_path')
    .eq('mission_id', missionId)

  if (existingCategoriesError) throw new Error(existingCategoriesError.message)

  const activeCategoryKeys = new Set(
    categories.map((category) => `${category.source_url}::${category.category_path.join('/')}`),
  )

  const staleCategoryIds = (existingCategories ?? [])
    .filter((category) => {
      const categoryKey = `${category.source_url}::${(category.category_path ?? []).join('/')}`
      return !activeCategoryKeys.has(categoryKey)
    })
    .map((category) => category.id)

  if (staleCategoryIds.length === 0) return 0

  const { error: deleteError } = await supabase
    .from('discovered_categories')
    .delete()
    .in('id', staleCategoryIds)

  if (deleteError) throw new Error(deleteError.message)

  return staleCategoryIds.length
}

async function failMissionDiscovery(
  supabase: Awaited<ReturnType<typeof createClient>>,
  missionId: string,
  startedAt: string | null,
  message: string,
) {
  if (startedAt) {
    await supabase
      .from('sourcing_mission_stage_metrics')
      .update({ finished_at: new Date().toISOString() })
      .eq('mission_id', missionId)
      .eq('stage_name', 'discovery')
      .eq('started_at', startedAt)
  }

  await supabase
    .from('sourcing_missions')
    .update({ status: 'failed_retrying' })
    .eq('id', missionId)

  revalidatePath('/workspace')

  return { data: null, error: { message } }
}

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

  if (stageInsertError) {
    return failMissionDiscovery(
      supabase,
      parsed.data.mission_id,
      null,
      stageInsertError.message,
    )
  }

  const { data: mission, error: missionError } = await supabase
    .from('sourcing_missions')
    .select('id, seed_url')
    .eq('id', parsed.data.mission_id)
    .single()

  if (missionError) {
    return failMissionDiscovery(
      supabase,
      parsed.data.mission_id,
      startedAt,
      missionError.message,
    )
  }

  const seedUrl = parsed.data.seed_url ?? mission.seed_url

  let discovered: Awaited<ReturnType<typeof scrapeYupooDiscovery>>

  try {
    discovered = parsed.data.html_snapshot
      ? {
          ...extractDiscoveryFromHtml(parsed.data.html_snapshot, seedUrl, startedAt),
          pages: [],
        }
      : await scrapeYupooDiscovery(seedUrl)
  } catch (error) {
    return failMissionDiscovery(
      supabase,
      parsed.data.mission_id,
      startedAt,
      error instanceof Error ? error.message : 'Failed to scrape Yupoo HTML.',
    )
  }

  if (
    !parsed.data.html_snapshot &&
    discovered.categories.length === 0 &&
    discovered.pages.length > 0 &&
    discovered.pages.every((page) => page.status === 'failed')
  ) {
    return failMissionDiscovery(
      supabase,
      parsed.data.mission_id,
      startedAt,
      discovered.pages[0]?.error ?? 'Every Yupoo discovery request failed.',
    )
  }

  const finishedAt = new Date().toISOString()

  try {
    await writeAgentRunArtifact('scouting', parsed.data.mission_id, startedAt, {
      finished_at: finishedAt,
      seed_url: seedUrl,
      used_html_snapshot: Boolean(parsed.data.html_snapshot),
      categories_count: discovered.categories.length,
      suppliers_count: discovered.suppliers.length,
      pages: discovered.pages,
      categories: discovered.categories,
      suppliers: discovered.suppliers,
    })
  } catch (error) {
    console.error('Failed to write scouting artifact', error)
  }

  try {
    await pruneMissingDiscoveredCategories(supabase, parsed.data.mission_id, discovered.categories)
  } catch (error) {
    return failMissionDiscovery(
      supabase,
      parsed.data.mission_id,
      startedAt,
      error instanceof Error ? error.message : 'Failed to prune stale categories.',
    )
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
          preview_image_urls: category.preview_image_urls,
          extracted_at: category.extracted_at,
          confidence: category.confidence,
        })),
        { onConflict: 'mission_id,source_url,category_path' },
      )

    if (categoriesError) {
      return failMissionDiscovery(
        supabase,
        parsed.data.mission_id,
        startedAt,
        categoriesError.message,
      )
    }
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

    if (suppliersError) {
      return failMissionDiscovery(
        supabase,
        parsed.data.mission_id,
        startedAt,
        suppliersError.message,
      )
    }
  }

  const { error: stageFinishError } = await supabase
    .from('sourcing_mission_stage_metrics')
    .update({ finished_at: finishedAt })
    .eq('mission_id', parsed.data.mission_id)
    .eq('stage_name', 'discovery')
    .eq('started_at', startedAt)

  if (stageFinishError) {
    return failMissionDiscovery(
      supabase,
      parsed.data.mission_id,
      startedAt,
      stageFinishError.message,
    )
  }

  const { error: missionAdvanceError } = await supabase
    .from('sourcing_missions')
    .update({ status: 'classifying_categories' })
    .eq('id', parsed.data.mission_id)

  if (missionAdvanceError) {
    return failMissionDiscovery(
      supabase,
      parsed.data.mission_id,
      startedAt,
      missionAdvanceError.message,
    )
  }

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
