import { z } from 'zod'

export const ClassificationStatusSchema = z.enum([
  'auto_accepted',
  'needs_review',
  'reviewed',
])

export const ClassificationMethodSchema = z.enum([
  'rules',
  'embedding',
  'manual',
])

export const RunMissionCategoryClassificationSchema = z.object({
  mission_id: z.string().uuid(),
})

export const ReviewMissionCategoryClassificationSchema = z.object({
  category_id: z.string().uuid(),
  decision: z.enum(['accept', 'edit', 'reject']),
  brand: z.string().trim().optional(),
  product: z.string().trim().optional(),
})

export type ClassificationStatus = z.infer<typeof ClassificationStatusSchema>
export type ClassificationMethod = z.infer<typeof ClassificationMethodSchema>
export type RunMissionCategoryClassificationValues = z.infer<
  typeof RunMissionCategoryClassificationSchema
>
export type ReviewMissionCategoryClassificationValues = z.infer<
  typeof ReviewMissionCategoryClassificationSchema
>
