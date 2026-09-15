import { describe, expect, it } from 'vitest'
import {
  formatMissionDiagnostics,
  formatMissionError,
  formatMissionEventLabel,
  formatMissionStageLabel,
  formatMissionStatusLabel,
} from './mission-display'

describe('mission display copy', () => {
  it('translates internal mission states and events into user-facing labels', () => {
    expect(formatMissionStatusLabel('failed_retrying')).toBe('Retry scheduled')
    expect(formatMissionStageLabel('classifying_categories')).toBe('Category classification')
    expect(formatMissionEventLabel('worker_discovery_fetch_started')).toBe('Fetching source pages')
  })

  it('turns common scraper errors into readable operator messages', () => {
    expect(formatMissionError({ message: 'HTTP 525' })).toEqual({
      title: 'Source request failed',
      detail: 'The source SSL connection failed.',
    })
    expect(formatMissionError({ message: 'fetch failed' })).toEqual({
      title: 'Source could not be reached',
      detail: 'The scraper could not connect to the source. Check the URL and try again.',
    })
  })

  it('formats diagnostics without exposing raw JSON keys', () => {
    expect(formatMissionDiagnostics({
      failed_pages_count: 2,
      using_html_snapshot: false,
      seed_url: 'https://west42.x.yupoo.com/categories',
      payload_keys: ['mission_id', 'run_id'],
    })).toEqual([
      { label: 'Failed Pages', value: '2' },
      { label: 'Using HTML Snapshot', value: 'No' },
      { label: 'Seed URL', value: 'west42.x.yupoo.com/categories' },
      { label: 'Payload Keys', value: '2 items' },
    ])
  })
})
