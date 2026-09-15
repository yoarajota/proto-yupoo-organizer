import { z } from 'zod'

export const GenerateOutreachSuggestionsSchema = z.object({
  mission_id: z.string().uuid(),
  max_suggestions: z.number().int().min(1).max(50).default(10),
})

export const ApproveOutreachSuggestionSchema = z.object({
  suggestion_id: z.string().uuid(),
})

export const ExportOutreachSuggestionSchema = z.object({
  suggestion_id: z.string().uuid(),
})

export type GenerateOutreachSuggestionsValues = z.infer<typeof GenerateOutreachSuggestionsSchema>
export type ApproveOutreachSuggestionValues = z.infer<typeof ApproveOutreachSuggestionSchema>
export type ExportOutreachSuggestionValues = z.infer<typeof ExportOutreachSuggestionSchema>
