type OutreachTemplateInput = {
  productIntent: string
  destinationContext?: string | null
  constraints?: Record<string, unknown> | null
  supplierKey: string
}

function formatConstraintSummary(constraints?: Record<string, unknown> | null) {
  if (!constraints || Object.keys(constraints).length === 0) return 'No extra constraints beyond product intent.'

  return Object.entries(constraints)
    .slice(0, 5)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join('; ')
}

export function buildOutreachMessage(input: OutreachTemplateInput) {
  const destination = input.destinationContext?.trim() ? ` Destination context: ${input.destinationContext}.` : ''
  const constraintSummary = formatConstraintSummary(input.constraints)

  return [
    `Hi ${input.supplierKey}, we are sourcing ${input.productIntent}.${destination}`,
    `Specs and constraints: ${constraintSummary}`,
    'Please share your best unit price, MOQ, and lead time for this item.',
    'Please also send your latest catalogue link or media set.',
    'Reply format preferred: Price=<value> | MOQ=<value> | LeadTime=<value> | Catalogue=<link or yes/no>.',
  ].join(' ')
}
