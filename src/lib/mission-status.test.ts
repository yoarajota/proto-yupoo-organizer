import { describe, expect, it } from 'vitest'
import {
  assertMissionStatusTransition,
  canTransitionMissionStatus,
  missionStageQueuedStatus,
} from './mission-status'

describe('mission status transitions', () => {
  it('maps stages to queued statuses', () => {
    expect(missionStageQueuedStatus.discovery).toBe('discovery_queued')
    expect(missionStageQueuedStatus.classifying_categories).toBe('classification_queued')
  })

  it('allows queue, running, retry, and terminal paths', () => {
    expect(canTransitionMissionStatus('created', 'discovery_queued')).toBe(true)
    expect(canTransitionMissionStatus('discovery_queued', 'scanning')).toBe(true)
    expect(canTransitionMissionStatus('scanning', 'completed')).toBe(true)
    expect(canTransitionMissionStatus('completed', 'classification_queued')).toBe(true)
    expect(canTransitionMissionStatus('classification_queued', 'classifying_categories')).toBe(true)
    expect(canTransitionMissionStatus('classifying_categories', 'completed')).toBe(true)
    expect(canTransitionMissionStatus('failed_retrying', 'discovery_queued')).toBe(true)
  })

  it('rejects ad hoc jumps from terminal or unrelated states', () => {
    expect(canTransitionMissionStatus('completed', 'matching_queued')).toBe(false)
    expect(() => assertMissionStatusTransition('created', 'completed')).toThrow(
      'Invalid mission status transition',
    )
  })
})
