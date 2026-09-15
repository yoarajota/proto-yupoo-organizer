import { createAdminClient } from '@/lib/supabase/admin'
import {
  executeMissionStage,
  parseMissionWorkerPayload,
} from '@/lib/mission-stage-runner'
import { ZodError } from 'zod'

export const runtime = 'nodejs'

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, { status })
}

function isAuthorized(request: Request) {
  const token = process.env.MISSION_WORKER_TOKEN
  const authorization = request.headers.get('authorization')

  if (!token || !authorization) return false
  return authorization === `Bearer ${token}`
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON body.' }, 400)
  }

  const parsed = parseMissionWorkerPayload(body)
  if (!parsed.success) {
    return jsonResponse({ error: 'Invalid mission worker payload.' }, 400)
  }

  try {
    const supabase = createAdminClient()
    const result = await executeMissionStage(
      supabase,
      parsed.data.stage,
      parsed.data.payload,
    )

    return jsonResponse({
      mission_id: parsed.data.payload.mission_id,
      stage: parsed.data.stage,
      result,
    })
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonResponse({ error: 'Invalid mission stage payload.' }, 400)
    }

    return jsonResponse({
      error: error instanceof Error ? error.message : 'Mission worker failed.',
    }, 500)
  }
}
