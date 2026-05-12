import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import {
  compareYupooScrapeEvalReports,
  type YupooScrapeEvalComparison,
  type YupooScrapeEvalReport,
} from '../src/lib/yupoo/scrape-eval.ts'

type CommandResult = {
  command: string
  exitCode: number
  stdout: string
  stderr: string
}

function runCommand(command: string, args: string[]) {
  return new Promise<CommandResult>((resolve) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk) => {
      const text = String(chunk)
      stdout += text
      process.stdout.write(text)
    })
    child.stderr.on('data', (chunk) => {
      const text = String(chunk)
      stderr += text
      process.stderr.write(text)
    })
    child.on('close', (exitCode) => {
      resolve({
        command: [command, ...args].join(' '),
        exitCode: exitCode ?? 1,
        stdout,
        stderr,
      })
    })
  })
}

function parseRunDir(stdout: string) {
  const match = stdout.match(/"run_dir"\s*:\s*"([^"]+)"/)
  if (match?.[1]) return match[1]

  return null
}

async function readOptionalText(filePath: string) {
  try {
    return (await readFile(filePath, 'utf8')).trim()
  } catch {
    return null
  }
}

function formatComparison(comparison: YupooScrapeEvalComparison | null) {
  if (!comparison) return ['## Iteration Comparison', '- no previous run available'].join('\n')

  const improvedClusters = comparison.improved_failure_clusters
    .map((cluster) => `- ${cluster.code}: ${cluster.previous_count} -> ${cluster.current_count}`)
    .join('\n')
  const regressions = comparison.previously_passing_regressions
    .map((regression) => `- ${regression.id}: ${regression.notes.join(', ')}`)
    .join('\n')
  const shopImprovements = comparison.shop_deltas
    .filter((delta) => delta.improved)
    .map((delta) => `- ${delta.id}: ${delta.notes.join(', ')}`)
    .join('\n')

  return [
    '## Iteration Comparison',
    `Previous run: ${comparison.previous_run_dir}`,
    `Passed shop delta: ${comparison.passed_shop_delta}`,
    `Failed shop delta: ${comparison.failed_shop_delta}`,
    `Acceptance: ${comparison.acceptance.accepted ? 'accepted' : 'not accepted'}`,
    `- unit tests passed: ${comparison.acceptance.unit_tests_passed}`,
    `- no previously passing regressions: ${comparison.acceptance.no_previously_passing_regressions}`,
    `- improved failure cluster or failing shop: ${comparison.acceptance.at_least_one_failure_cluster_improved}`,
    '',
    '### Improved Failure Clusters',
    improvedClusters || '- none',
    '',
    '### Shop Improvements',
    shopImprovements || '- none',
    '',
    '### Regressions',
    regressions || '- none',
  ].join('\n')
}

function formatCodexReport(
  report: YupooScrapeEvalReport,
  testResult: CommandResult,
  comparison: YupooScrapeEvalComparison | null,
) {
  const failedShops = report.shops.filter((shop) => !shop.ok)
  const clusters = report.common_failure_clusters
    .map((cluster) => `- ${cluster.code}: ${cluster.count} (${cluster.shop_ids.join(', ')})`)
    .join('\n')
  const failures = failedShops
    .map((shop) => `- ${shop.id}: ${shop.failure_codes.join(', ')}; artifact ${shop.artifact_path}`)
    .join('\n')

  return [
    '# Codex Yupoo Scrape Eval Report',
    '',
    `Run directory: ${report.run_dir}`,
    `Generated at: ${report.generated_at}`,
    `Shops: ${report.passed_shops}/${report.total_shops} passed`,
    `Scout tests: ${testResult.exitCode === 0 ? 'passed' : 'failed'} (${testResult.command})`,
    '',
    '## Failure Clusters',
    clusters || '- none',
    '',
    '## Failed Shops',
    failures || '- none',
    '',
    '## Missing Preview Image Cases',
    report.missing_preview_image_cases
      .slice(0, 20)
      .map((item) => `- ${item.shop_id}: ${item.raw_label} (${item.source_url})`)
      .join('\n') || '- none',
    '',
    '## Blocked Or Failed Pages',
    report.blocked_or_failed_pages
      .slice(0, 20)
      .map((item) => `- ${item.shop_id}: ${item.url} ${item.error ?? item.http_status ?? ''}`.trim())
      .join('\n') || '- none',
    '',
    formatComparison(comparison),
    '',
    '## Patch Target',
    'Use the artifact paths above to inspect page diagnostics, content hashes, labels, and preview-debug candidates. Patch `src/lib/yupoo/scout.ts` plus focused mocked tests in `src/lib/yupoo/scout.test.ts`, then rerun `pnpm scrape:eval:loop`. Accept a patch only when tests pass, previously passing shops do not regress, and at least one failing cluster or failing shop improves.',
    '',
  ].join('\n')
}

async function main() {
  const args = process.argv.slice(2).filter((arg) => arg !== '--')
  const previousFlagIndex = args.indexOf('--previous')
  const previousRunDirFromFlag = previousFlagIndex >= 0 ? args[previousFlagIndex + 1] : null
  const inputPath = args.find((arg, index) => index !== previousFlagIndex && index !== previousFlagIndex + 1 && !arg.startsWith('--')) ?? 'data/yupoo-shop-eval.json'
  const latestPath = path.join('storage/codex-loop/yupoo-scrape-runs', 'latest.txt')
  const previousRunDir = previousRunDirFromFlag ?? (await readOptionalText(latestPath))
  const scrapeResult = await runCommand('pnpm', ['scrape:eval', '--', inputPath])
  const runDir = parseRunDir(scrapeResult.stdout)

  if (!runDir) {
    throw new Error('Scrape eval did not emit a run_dir.')
  }

  const analyzeResult = await runCommand('pnpm', ['scrape:eval:analyze', '--', runDir])
  const testResult = await runCommand('pnpm', ['test:run', 'src/lib/yupoo/scout.test.ts'])
  const report = JSON.parse(await readFile(path.join(runDir, 'analysis-report.json'), 'utf8')) as YupooScrapeEvalReport
  let comparison: YupooScrapeEvalComparison | null = null

  if (previousRunDir && previousRunDir !== runDir) {
    try {
      const previous = JSON.parse(await readFile(path.join(previousRunDir, 'analysis-report.json'), 'utf8')) as YupooScrapeEvalReport
      comparison = compareYupooScrapeEvalReports({
        previous,
        current: report,
        unitTestsPassed: testResult.exitCode === 0,
      })
      await writeFile(path.join(runDir, 'comparison-report.json'), JSON.stringify(comparison, null, 2))
    } catch (error) {
      await writeFile(
        path.join(runDir, 'comparison-error.txt'),
        error instanceof Error ? error.message : 'Failed to compare eval runs.',
      )
    }
  }

  const codexReportPath = path.join(runDir, 'codex-report.md')

  await writeFile(
    path.join(runDir, 'loop-results.json'),
    JSON.stringify({ scrape: scrapeResult, analyze: analyzeResult, scout_tests: testResult, comparison }, null, 2),
  )
  await writeFile(codexReportPath, formatCodexReport(report, testResult, comparison))

  console.log(
    JSON.stringify(
      {
        ok: scrapeResult.exitCode === 0 && analyzeResult.exitCode === 0 && testResult.exitCode === 0,
        accepted: comparison?.acceptance.accepted ?? null,
        run_dir: runDir,
        previous_run_dir: previousRunDir,
        codex_report_path: codexReportPath,
      },
      null,
      2,
    ),
  )

  if (testResult.exitCode !== 0 || analyzeResult.exitCode !== 0 || scrapeResult.exitCode !== 0) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Yupoo scrape eval loop failed.')
  process.exitCode = 1
})
