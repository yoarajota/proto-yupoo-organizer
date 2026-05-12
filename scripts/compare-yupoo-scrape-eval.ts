import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  compareYupooScrapeEvalReports,
  type YupooScrapeEvalReport,
} from '../src/lib/yupoo/scrape-eval.ts'

async function loadReport(runDir: string) {
  return JSON.parse(await readFile(path.join(runDir, 'analysis-report.json'), 'utf8')) as YupooScrapeEvalReport
}

async function main() {
  const args = process.argv.slice(2).filter((arg) => arg !== '--')
  const previousRunDir = args[0]
  const currentRunDir = args[1]

  if (!previousRunDir || !currentRunDir) {
    throw new Error(
      'Usage: pnpm scrape:eval:compare -- storage/codex-loop/yupoo-scrape-runs/<previous> storage/codex-loop/yupoo-scrape-runs/<current>',
    )
  }

  const unitTestsPassed = !args.includes('--tests-failed')
  const previous = await loadReport(previousRunDir)
  const current = await loadReport(currentRunDir)
  const comparison = compareYupooScrapeEvalReports({ previous, current, unitTestsPassed })
  const comparisonPath = path.join(currentRunDir, 'comparison-report.json')

  await writeFile(comparisonPath, JSON.stringify(comparison, null, 2))
  console.log(JSON.stringify({ ok: comparison.acceptance.accepted, comparison_path: comparisonPath, ...comparison }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Yupoo scrape eval comparison failed.')
  process.exitCode = 1
})

