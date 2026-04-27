export type ParsedInboundOffer = {
  unitPrice: number | null
  currency: string | null
  moq: number | null
  leadTime: string | null
  termsNotes: string | null
  extractionConfidence: number
  catalogueSummary: string | null
}

const PRICE_REGEX = /(?:price|unit\s*price)\s*[:=\-]?\s*(?:usd|cny|rmb|\$)?\s*(\d+(?:\.\d+)?)/i
const CURRENCY_REGEX = /(usd|cny|rmb|\$)/i
const MOQ_REGEX = /moq\s*[:=\-]?\s*(\d+)/i
const LEAD_TIME_REGEX = /lead\s*time\s*[:=\-]?\s*([a-z0-9\- ]{2,40})/i
const LEAD_TIME_FALLBACK_REGEX = /(\d+\s*(?:day|days|week|weeks))/i
const CATALOGUE_REGEX = /(?:catalog(?:ue)?|album|catalog)\s*[:=\-]?\s*(https?:\/\/\S+|yes|available)/i

function round4(value: number) {
  return Math.round(value * 10000) / 10000
}

export function parseInboundMessage(body: string): ParsedInboundOffer {
  const priceMatch = body.match(PRICE_REGEX)
  const moqMatch = body.match(MOQ_REGEX)
  const leadTimeMatch = body.match(LEAD_TIME_REGEX) ?? body.match(LEAD_TIME_FALLBACK_REGEX)
  const catalogueMatch = body.match(CATALOGUE_REGEX)
  const currencyMatch = body.match(CURRENCY_REGEX)

  const unitPrice = priceMatch ? Number(priceMatch[1]) : null
  const moq = moqMatch ? Number(moqMatch[1]) : null
  const leadTime = leadTimeMatch ? leadTimeMatch[1].trim() : null

  let currency: string | null = null
  if (currencyMatch) {
    const raw = currencyMatch[1].toUpperCase()
    currency = raw === '$' ? 'USD' : raw
  }

  let confidence = 0.35
  if (unitPrice !== null) confidence += 0.2
  if (moq !== null) confidence += 0.15
  if (leadTime !== null) confidence += 0.15
  if (catalogueMatch) confidence += 0.15

  const extractionConfidence = round4(Math.min(0.95, confidence))
  const catalogueSummary = catalogueMatch
    ? `Catalogue signal detected: ${catalogueMatch[1]}`
    : null

  return {
    unitPrice,
    currency,
    moq,
    leadTime,
    termsNotes: body.slice(0, 400),
    extractionConfidence,
    catalogueSummary,
  }
}
