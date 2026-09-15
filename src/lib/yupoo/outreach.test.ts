import { describe, expect, it } from 'vitest'
import { buildOutreachMessage } from './outreach'

describe('buildOutreachMessage', () => {
  it('builds deterministic English outreach template', () => {
    const message = buildOutreachMessage({
      productIntent: 'women leather tote bags',
      destinationContext: 'Brazil market',
      constraints: { color: 'black', material: 'leather' },
      supplierKey: 'bagworld',
    })

    expect(message).toContain('Hi bagworld')
    expect(message).toContain('women leather tote bags')
    expect(message).toContain('Please share your best unit price, MOQ, and lead time')
    expect(message).toContain('latest catalogue link or media set')
    expect(message).toContain('Reply format preferred')
  })
})
