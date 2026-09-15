import { z } from 'zod'

export const ProductCreateSchema = z.object({
  notes: z.string().optional(),
})
export type ProductCreateValues = z.infer<typeof ProductCreateSchema>

export const ProductUpdateSchema = z.object({
  notes: z.string().optional(),
  brand_id: z.string().uuid().nullable().optional(),
  product_type_id: z.string().uuid().nullable().optional(),
})
export type ProductUpdateValues = z.infer<typeof ProductUpdateSchema>
