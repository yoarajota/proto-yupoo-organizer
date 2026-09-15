import { z } from 'zod'

export const SupplierSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  yupoo_url: z.string().url('Must be a valid URL'),
  whatsapp_contact: z.string().min(1, 'WhatsApp contact is required'),
  brand_ids: z.array(z.string().uuid()).optional(),
  product_type_ids: z.array(z.string().uuid()).optional(),
  trust_notes: z.string().optional(),
  is_flagged: z.boolean(),
  red_flag_source: z.string().optional(),
  negotiation_opening_price: z.number().optional(),
  negotiation_final_price: z.number().optional(),
})

export type SupplierFormValues = z.infer<typeof SupplierSchema>
