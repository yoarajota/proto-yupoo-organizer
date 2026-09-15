import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { toSlug } from '../src/lib/catalog.ts'
import type { CanonicalBrand } from '../src/lib/yupoo/category-config.ts'
import { scrapeYupooDiscovery } from '../src/lib/yupoo/scout.ts'
import {
  getTimestampRunDir,
  loadYupooShopEvalInput,
  summarizeYupooShopRun,
  toRunDir,
  type YupooShopRunSummary,
} from '../src/lib/yupoo/scrape-eval.ts'

function parseArgs() {
  const args = process.argv.slice(2).filter((arg) => arg !== '--')
  return {
    inputPath: args[0] ?? 'data/yupoo-shop-eval.json',
    maxRequestsOverride: args.includes('--max-requests')
      ? Number(args[args.indexOf('--max-requests') + 1])
      : undefined,
  }
}

function sanitizeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9_.-]+/g, '-')
}

async function loadCatalogBrands(): Promise<CanonicalBrand[] | undefined> {
  try {
    const raw = await readFile('data/catalog-import.json', 'utf8')
    const payload = JSON.parse(raw) as {
      brands?: Array<{ name?: unknown; aliases?: unknown }>
    }
    const brands = (payload.brands ?? [])
      .filter((brand) => typeof brand.name === 'string' && brand.name.trim())
      .map((brand) => {
        const name = (brand.name as string).trim()
        const slug = toSlug(name)
        const aliases = Array.from(
          new Set(
            [
              name,
              slug,
              ...(Array.isArray(brand.aliases)
                ? brand.aliases.filter((alias): alias is string => typeof alias === 'string' && alias.trim().length > 0)
                : []),
            ].map((alias) => alias.trim()).filter(Boolean),
          ),
        )
        return {
          canonical: slug,
          display: name,
          aliases,
          embeddingTerms: aliases,
        }
      })
      .filter((brand) => brand.canonical)
    return brands.length > 0 ? brands : undefined
  } catch {
    return undefined
  }
}

async function main() {
  const { inputPath, maxRequestsOverride } = parseArgs()
  const evalInput = await loadYupooShopEvalInput(inputPath)
  const catalogBrands = await loadCatalogBrands()
  const timestamp = getTimestampRunDir()
  const runDir = toRunDir(timestamp)
  const artifactDir = path.join(runDir, 'artifacts')
  const summaries: YupooShopRunSummary[] = []

  await mkdir(artifactDir, { recursive: true })

  await writeFile(
    path.join(runDir, 'run-metadata.json'),
    JSON.stringify(
      {
        input_path: inputPath,
        started_at: new Date().toISOString(),
        max_requests: maxRequestsOverride ?? evalInput.max_requests ?? null,
        shop_count: evalInput.shops.length,
      },
      null,
      2,
    ),
  )

  for (const shop of evalInput.shops) {
    const startedAt = Date.now()
    const maxRequests = maxRequestsOverride ?? shop.max_requests ?? evalInput.max_requests ?? undefined
    const artifactPath = path.join(artifactDir, `${sanitizeFileName(shop.id ?? new URL(shop.url).hostname)}.json`)

    try {
      const result = await scrapeYupooDiscovery(shop.url, maxRequests)
      const summary = summarizeYupooShopRun({
        shop,
        result,
        artifactPath,
        durationMs: Date.now() - startedAt,
        canonical_brands: catalogBrands,
      })

      await writeFile(
        artifactPath,
        JSON.stringify(
          {
            shop,
            max_requests: maxRequests ?? null,
            summary,
            result,
          },
          null,
          2,
        ),
      )
      summaries.push(summary)
    } catch (error) {
      const summary = summarizeYupooShopRun({
        shop,
        result: null,
        artifactPath,
        durationMs: Date.now() - startedAt,
        error,
      })

      await writeFile(
        artifactPath,
        JSON.stringify(
          {
            shop,
            max_requests: maxRequests ?? null,
            summary,
            error: summary.error,
          },
          null,
          2,
        ),
      )
      summaries.push(summary)
    }
  }

  await writeFile(path.join(runDir, 'summary.jsonl'), `${summaries.map((summary) => JSON.stringify(summary)).join('\n')}\n`)
  await writeFile(path.join('storage/codex-loop/yupoo-scrape-runs', 'latest.txt'), `${runDir}\n`)

  console.log(
    JSON.stringify(
      {
        ok: summaries.every((summary) => summary.ok),
        run_dir: runDir,
        total_shops: summaries.length,
        failed_shops: summaries.filter((summary) => !summary.ok).length,
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Yupoo scrape eval failed.')
  process.exitCode = 1
})

