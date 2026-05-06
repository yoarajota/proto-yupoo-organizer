import { z } from "zod"

export const CatalogItemSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
})

export type CatalogItemValues = z.infer<typeof CatalogItemSchema>

export const BrandAliasSchema = z.object({
  brand_id: z.string().uuid(),
  alias: z.string().trim().min(1, "Alias is required"),
})

export type BrandAliasValues = z.infer<typeof BrandAliasSchema>

export const CatalogImportBrandSchema = z.object({
  name: z.string().trim().min(1, "Brand name is required"),
  aliases: z.array(z.string().trim().min(1)).default([]),
})

export const CatalogImportProductTypeSchema = z.object({
  name: z.string().trim().min(1, "Product type name is required"),
})

export const CatalogImportPayloadSchema = z.object({
  brands: z.array(CatalogImportBrandSchema).default([]),
  product_types: z.array(CatalogImportProductTypeSchema).default([]),
})

export type CatalogImportBrand = z.infer<typeof CatalogImportBrandSchema>
export type CatalogImportProductType = z.infer<typeof CatalogImportProductTypeSchema>
export type CatalogImportPayload = z.infer<typeof CatalogImportPayloadSchema>
