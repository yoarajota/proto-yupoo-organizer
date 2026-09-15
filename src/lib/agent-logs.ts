import { appendFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

type AgentLogKind = 'scouting' | 'classification'

function getLogDirectory(kind: AgentLogKind) {
  return path.join(process.cwd(), 'storage', 'agent-logs', kind)
}

export async function writeAgentRunArtifact(
  kind: AgentLogKind,
  missionId: string,
  startedAt: string,
  payload: Record<string, unknown>,
) {
  const directory = getLogDirectory(kind)
  await mkdir(directory, { recursive: true })

  const safeStartedAt = startedAt.replaceAll(':', '-')
  const runFile = path.join(directory, `${safeStartedAt}-${missionId}.json`)
  const summaryFile = path.join(directory, 'summary.jsonl')
  const record = {
    mission_id: missionId,
    started_at: startedAt,
    ...payload,
  }

  await writeFile(runFile, `${JSON.stringify(record, null, 2)}\n`, 'utf8')
  await appendFile(summaryFile, `${JSON.stringify(record)}\n`, 'utf8')

  return {
    run_file: runFile,
    summary_file: summaryFile,
  }
}
