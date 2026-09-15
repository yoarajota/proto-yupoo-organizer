import { z } from 'zod'

export const SourcingMissionStatusSchema = z.enum([
  'created',
  'discovery_queued',
  'scanning',
  'classification_queued',
  'classifying_categories',
  'matching_queued',
  'matching',
  'suggestions_ready',
  'outreach_queued',
  'awaiting_approval',
  'approved_for_outreach',
  'replies_received',
  'parse_queued',
  'offers_normalized',
  'completed',
  'blocked_needs_input',
  'failed_retrying',
  'failed_terminal',
])

export const CreateSourcingMissionSchema = z.object({
  seed_url: z.string().url('A valid Yupoo shop URL is required'),
  product_intent: z.string().trim().optional(),
  destination_context: z.string().trim().optional(),
  constraints: z.record(z.string(), z.unknown()).optional(),
})

export const UpdateSourcingMissionStatusSchema = z.object({
  status: SourcingMissionStatusSchema,
})

export const DeleteSourcingMissionSchema = z.object({
  mission_id: z.string().uuid(),
})

export type CreateSourcingMissionValues = z.infer<typeof CreateSourcingMissionSchema>
export type SourcingMissionStatus = z.infer<typeof SourcingMissionStatusSchema>
