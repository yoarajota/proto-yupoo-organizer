import { z } from "zod";

export const SourcePlatformSchema = z.enum([
  "reddit",
  "discord",
  "whatsapp",
  "other",
]);

export type SourcePlatform = z.infer<typeof SourcePlatformSchema>;

export const SourceCreateSchema = z.object({
  url: z.string().url("Must be a valid URL"),
  platform: SourcePlatformSchema,
  brands: z.array(z.string()),
  notes: z.string().optional().nullable(),
});

export type SourceCreateValues = z.infer<typeof SourceCreateSchema>;
