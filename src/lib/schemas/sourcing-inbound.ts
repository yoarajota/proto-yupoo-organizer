import { z } from 'zod'

export const IngestInboundMessageSchema = z.object({
  mission_id: z.string().uuid(),
  supplier_id: z.string().uuid(),
  channel: z.string().trim().min(1),
  body: z.string().trim().min(1),
  received_at: z.string().datetime().optional(),
})

export const ParseInboundOffersSchema = z.object({
  mission_id: z.string().uuid(),
  max_messages: z.number().int().min(1).max(200).default(50),
})

export type IngestInboundMessageValues = z.infer<typeof IngestInboundMessageSchema>
export type ParseInboundOffersValues = z.infer<typeof ParseInboundOffersSchema>
