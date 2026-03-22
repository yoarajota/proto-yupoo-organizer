import { z } from 'zod'

export const ProductCreateSchema = z.object({
  notes: z.string().optional(),
})
export type ProductCreateValues = z.infer<typeof ProductCreateSchema>

export const ProductUpdateSchema = z.object({
  notes: z.string().optional(),
})
export type ProductUpdateValues = z.infer<typeof ProductUpdateSchema>
