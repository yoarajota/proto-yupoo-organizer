import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  analyzeYupooScrapeSummaries,
  type YupooShopRunSummary,
} from '../src/lib/yupoo/scrape-eval.ts'

async function loadJsonlSummaries(summaryPath: string) {
  const raw = await readFile(summaryPath, 'utf8')
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as YupooShopRunSummary)
}

async function main() {
  const args = process.argv.slice(2).filter((arg) => arg !== '--')
  const runDir = args[0]
  if (!runDir) {
    throw new Error('Usage: pnpm scrape:eval:analyze -- storage/codex-loop/yupoo-scrape-runs/<timestamp>')
  }

  const summaries = await loadJsonlSummaries(path.join(runDir, 'summary.jsonl'))
  const report = analyzeYupooScrapeSummaries(runDir, summaries)
  const reportPath = path.join(runDir, 'analysis-report.json')

  await writeFile(reportPath, JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ ok: report.failed_shops === 0, report_path: reportPath, ...report }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Yupoo scrape eval analysis failed.')
  process.exitCode = 1
})

