import { z } from 'zod'

const DiscoveryCategorySchema = z.object({
  source_url: z.string().url(),
  category_path: z.array(z.string().trim().min(1)).min(1),
  raw_label: z.string().trim().min(1),
  preview_image_urls: z.array(z.string().url()).default([]),
  preview_image_status: z.enum(['fetched', 'discovered_only']).default('discovered_only'),
  extracted_at: z.string().datetime(),
  confidence: z.number().min(0).max(1),
})

const DiscoverySupplierSchema = z.object({
  supplier_key: z.string().trim().min(1),
  source_url: z.string().url(),
  category_refs: z.array(z.string().trim().min(1)).default([]),
  normalized_category_refs: z.array(z.string().trim().min(1)).default([]),
  last_seen_at: z.string().datetime(),
  confidence: z.number().min(0).max(1),
})

export const RunMissionDiscoverySchema = z.object({
  mission_id: z.string().uuid(),
  seed_url: z.string().url().optional(),
  html_snapshot: z.string().trim().min(1).optional(),
})

export const DiscoveryBatchSchema = z.object({
  categories: z.array(DiscoveryCategorySchema),
  suppliers: z.array(DiscoverySupplierSchema),
})

export const IngestMissionYupooImagesSchema = z.object({
  mission_id: z.string().uuid(),
  image_urls: z.array(z.string().url()).max(24),
})

export type RunMissionDiscoveryValues = z.infer<typeof RunMissionDiscoverySchema>
export type DiscoveryBatchValues = z.infer<typeof DiscoveryBatchSchema>
export type IngestMissionYupooImagesValues = z.infer<typeof IngestMissionYupooImagesSchema>
