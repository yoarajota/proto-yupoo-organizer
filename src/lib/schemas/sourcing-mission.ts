import { z } from 'zod'

export const SourcingMissionStatusSchema = z.enum([
  'created',
  'scanning',
  'classifying_categories',
  'matching',
  'suggestions_ready',
  'awaiting_approval',
  'approved_for_outreach',
  'replies_received',
  'offers_normalized',
  'completed',
  'blocked_needs_input',
  'failed_retrying',
  'failed_terminal',
])

export const CreateSourcingMissionSchema = z.object({
  product_intent: z.string().trim().min(1, 'Product intent is required'),
  seed_url: z.string().url('A valid Yupoo shop URL is required'),
  destination_context: z.string().trim().optional(),
  constraints: z.record(z.string(), z.unknown()).optional(),
})

export const UpdateSourcingMissionStatusSchema = z.object({
  status: SourcingMissionStatusSchema,
})

export type CreateSourcingMissionValues = z.infer<typeof CreateSourcingMissionSchema>
export type SourcingMissionStatus = z.infer<typeof SourcingMissionStatusSchema>
