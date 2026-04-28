import { z } from "zod"

export const CatalogItemSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
})

export type CatalogItemValues = z.infer<typeof CatalogItemSchema>
