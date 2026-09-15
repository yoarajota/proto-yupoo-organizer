// RUN WITH pnpm harvest:brand-aliases [-- --limit 500 --min-score 1 --out candidates.json]
//
// Offline alias mining (D-06): reads observed Yupoo raw labels plus manual review
// outcomes via the service role, mines scored alias candidates with the same pure
// miner the classifier uses, and prints candidate JSON. Nothing is written to the
// database here: a curator merges approved variants into data/catalog-import.json
// by hand (README curated-only rule), then runs pnpm catalog:import followed by
// pnpm catalog:embeddings:seed.

import { writeFile } from 'node:fs/promises'
import { config as loadDotenv } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import {
  mineCandidateAliases,
  type ReviewDecisionInput,
} from '../src/lib/yupoo/classification.ts'
import type { CanonicalBrand } from '../src/lib/yupoo/category-config.ts'

loadDotenv({ path: '.env.local', quiet: true })

type BrandRow = {
  id: string
  name: string
  slug: string
  brand_aliases: { alias: string }[] | null
}

type CategoryRow = {
  raw_label: string
  brand_signal: string | null
  classification_status: string
}

function parseArgs(argv: string[]) {
  const args = argv.filter((value) => value !== '--')
  if (args.includes('--help') || args.includes('-h')) return { help: true } as const

  const flag = (name: string) => {
    const index = args.indexOf(name)
    return index === -1 ? undefined : args[index + 1]
  }

  const limit = Number(flag('--limit') ?? 500)
  const minScore = Number(flag('--min-score') ?? 1)

  if (!Number.isInteger(limit) || limit <= 0) throw new Error('--limit must be a positive integer.')
  if (!Number.isFinite(minScore)) throw new Error('--min-score must be a number.')

  return {
    help: false as const,
    limit,
    minScore,
    out: flag('--out'),
  }
}

function getEnv(env: Partial<NodeJS.ProcessEnv> = process.env) {
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Missing required env vars: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are both required.',
    )
  }

  return { supabaseUrl, serviceRoleKey }
}

function toCanonicalBrands(rows: BrandRow[]): CanonicalBrand[] {
  return rows.map((row) => ({
    canonical: row.slug,
    display: row.name,
    aliases: (row.brand_aliases ?? []).map((alias) => alias.alias),
    embeddingTerms: [row.name],
  }))
}

async function main() {
  const options = parseArgs(process.argv.slice(2))

  if (options.help) {
    console.log('Usage: pnpm harvest:brand-aliases [-- --limit 500 --min-score 1 --out candidates.json]')
    return
  }

  const { supabaseUrl, serviceRoleKey } = getEnv()
  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const [{ data: brandRows, error: brandError }, { data: categoryRows, error: categoryError }] =
    await Promise.all([
      supabase.from('brands').select('id, name, slug, brand_aliases(alias)'),
      supabase
        .from('discovered_categories')
        .select('raw_label, brand_signal, classification_status')
        .limit(options.limit),
    ])

  if (brandError) throw new Error(brandError.message)
  if (categoryError) throw new Error(categoryError.message)

  const categories = (categoryRows ?? []) as CategoryRow[]
  const rawLabels = categories.map((row) => row.raw_label).filter(Boolean)
  const reviewDecisions: ReviewDecisionInput[] = categories
    .filter((row) => row.classification_status === 'reviewed')
    .map((row) => ({
      raw_label: row.raw_label,
      decision: row.brand_signal ? ('accept' as const) : ('reject' as const),
      brand_signal: row.brand_signal,
    }))

  const candidates = mineCandidateAliases(
    rawLabels,
    reviewDecisions,
    toCanonicalBrands((brandRows ?? []) as BrandRow[]),
  ).filter((candidate) => candidate.score >= options.minScore)

  const payload = {
    generated_at: new Date().toISOString(),
    observed_labels: rawLabels.length,
    review_decisions: reviewDecisions.length,
    candidate_count: candidates.length,
    candidates,
  }
  const serialized = JSON.stringify(payload, null, 2)

  if (options.out) {
    await writeFile(options.out, `${serialized}\n`)
    console.error(`Wrote ${candidates.length} alias candidates to ${options.out}`)
  } else {
    console.log(serialized)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Brand alias harvest failed.')
  process.exitCode = 1
})
