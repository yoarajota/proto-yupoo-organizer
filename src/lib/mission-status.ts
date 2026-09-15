import { z } from 'zod'
import {
  SourcingMissionStatusSchema,
  type SourcingMissionStatus,
} from '@/lib/schemas/sourcing-mission'

export const MissionStageSchema = z.enum([
  'discovery',
  'classifying_categories',
  'matching',
  'suggestion_generation',
  'parse',
])

export type MissionStage = z.infer<typeof MissionStageSchema>

export const missionStageRunningStatus: Record<MissionStage, SourcingMissionStatus> = {
  discovery: 'scanning',
  classifying_categories: 'classifying_categories',
  matching: 'matching',
  suggestion_generation: 'suggestions_ready',
  parse: 'replies_received',
}

export const missionStageQueuedStatus: Record<MissionStage, SourcingMissionStatus> = {
  discovery: 'discovery_queued',
  classifying_categories: 'classification_queued',
  matching: 'matching_queued',
  suggestion_generation: 'outreach_queued',
  parse: 'parse_queued',
}

export const terminalMissionStatuses = new Set<SourcingMissionStatus>([
  'completed',
  'failed_terminal',
])

const allowedTransitions: Record<SourcingMissionStatus, SourcingMissionStatus[]> = {
  created: ['discovery_queued', 'scanning', 'blocked_needs_input', 'failed_retrying'],
  discovery_queued: ['scanning', 'failed_retrying', 'failed_terminal'],
  scanning: ['completed', 'classification_queued', 'classifying_categories', 'failed_retrying', 'failed_terminal'],
  classification_queued: ['classifying_categories', 'completed', 'discovery_queued', 'failed_retrying', 'failed_terminal'],
  classifying_categories: ['completed', 'classification_queued', 'discovery_queued', 'failed_retrying', 'failed_terminal'],
  matching_queued: ['discovery_queued', 'failed_terminal'],
  matching: ['discovery_queued', 'failed_terminal'],
  suggestions_ready: ['discovery_queued', 'failed_terminal'],
  outreach_queued: ['discovery_queued', 'failed_terminal'],
  awaiting_approval: ['discovery_queued', 'failed_terminal'],
  approved_for_outreach: ['discovery_queued', 'failed_terminal'],
  replies_received: ['discovery_queued', 'failed_terminal'],
  parse_queued: ['discovery_queued', 'failed_terminal'],
  offers_normalized: ['discovery_queued', 'failed_terminal'],
  completed: ['classification_queued', 'discovery_queued'],
  blocked_needs_input: ['discovery_queued', 'classification_queued', 'failed_retrying'],
  failed_retrying: ['discovery_queued', 'classification_queued', 'failed_terminal'],
  failed_terminal: [],
}

export function canTransitionMissionStatus(
  from: SourcingMissionStatus,
  to: SourcingMissionStatus,
) {
  if (from === to) return true
  return allowedTransitions[from]?.includes(to) ?? false
}

export function assertMissionStatusTransition(
  from: string,
  to: string,
) {
  const parsedFrom = SourcingMissionStatusSchema.parse(from)
  const parsedTo = SourcingMissionStatusSchema.parse(to)

  if (!canTransitionMissionStatus(parsedFrom, parsedTo)) {
    throw new Error(`Invalid mission status transition from ${parsedFrom} to ${parsedTo}.`)
  }

  return parsedTo
}
