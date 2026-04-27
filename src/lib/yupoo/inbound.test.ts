import { describe, expect, it } from 'vitest'
import { parseInboundMessage } from './inbound'

describe('parseInboundMessage', () => {
  it('extracts offer and catalogue fields from structured inbound message', () => {
    const parsed = parseInboundMessage(
      'Price=48 USD | MOQ=20 | Lead Time=7 days | Catalogue=https://supplier.example/catalog',
    )

    expect(parsed.unitPrice).toBe(48)
    expect(parsed.currency).toBe('USD')
    expect(parsed.moq).toBe(20)
    expect(parsed.leadTime?.toLowerCase()).toContain('7 days')
    expect(parsed.catalogueSummary).toContain('Catalogue signal detected')
    expect(parsed.extractionConfidence).toBeGreaterThan(0.7)
  })

  it('returns low-confidence parse when no structured fields exist', () => {
    const parsed = parseInboundMessage('hello, please tell me what you need')

    expect(parsed.unitPrice).toBeNull()
    expect(parsed.moq).toBeNull()
    expect(parsed.leadTime).toBeNull()
    expect(parsed.catalogueSummary).toBeNull()
    expect(parsed.extractionConfidence).toBeLessThanOrEqual(0.4)
  })
})
