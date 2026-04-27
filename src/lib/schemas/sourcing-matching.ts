import { z } from 'zod'

export const RunMissionMatchingSchema = z.object({
  mission_id: z.string().uuid(),
  shortlist_limit: z.number().int().min(1).max(100).default(10),
})

export type RunMissionMatchingValues = z.infer<typeof RunMissionMatchingSchema>
