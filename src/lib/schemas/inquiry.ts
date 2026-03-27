import { z } from "zod";
import type { Database } from "@/types/database";

type DBInquiryStatus = Database["public"]["Enums"]["inquiry_status"];

export const InquiryStatusSchema = z.enum([
  "sent",
  "price_received",
  "negotiating",
  "decided",
  "ghosted",
]);

export type InquiryStatus = DBInquiryStatus;

export const InquiryCreateSchema = z.object({
  product_id: z.string().uuid(),
  supplier_id: z.string().uuid(),
  status: InquiryStatusSchema,
  price: z.number().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type InquiryCreateValues = z.infer<typeof InquiryCreateSchema>;

export const InquiryUpdateSchema = z.object({
  status: InquiryStatusSchema.optional(),
  price: z.number().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type InquiryUpdateValues = z.infer<typeof InquiryUpdateSchema>;
