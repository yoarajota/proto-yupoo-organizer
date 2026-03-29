"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  InquiryCreateSchema,
  InquiryUpdateSchema,
  type InquiryCreateValues,
  type InquiryUpdateValues,
} from "@/lib/schemas/inquiry";

export async function createInquiry(values: InquiryCreateValues) {
  const parsed = InquiryCreateSchema.safeParse(values);
  if (!parsed.success) {
    return { data: null, error: { message: "Invalid inquiry data" } };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: { message: "Unauthorized" } };

  const { data, error } = await supabase
    .from("inquiries")
    .insert({
      ...parsed.data,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return { data: null, error: { message: error.message } };

  revalidatePath("/active-inquiries");
  revalidatePath(`/products/${parsed.data.product_id}`);
  return { data, error: null };
}

export async function updateInquiry(id: string, values: InquiryUpdateValues) {
  const parsed = InquiryUpdateSchema.safeParse(values);
  if (!parsed.success) {
    return { data: null, error: { message: "Invalid inquiry data" } };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: { message: "Unauthorized" } };

  const { data, error } = await supabase
    .from("inquiries")
    .update(parsed.data)
    .eq("id", id)
    .select()
    .single();

  if (error) return { data: null, error: { message: error.message } };
  if (!data)
    return {
      data: null,
      error: { message: "Inquiry not found or permission denied" },
    };

  revalidatePath("/active-inquiries");
  revalidatePath(`/products/${data.product_id}`);
  return { data, error: null };
}

export async function deleteInquiry(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: { message: "Unauthorized" } };

  const { data: inquiry } = await supabase
    .from("inquiries")
    .select("product_id")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("inquiries").delete().eq("id", id);

  if (error) return { error: { message: error.message } };

  revalidatePath("/active-inquiries");
  if (inquiry) {
    revalidatePath(`/products/${inquiry.product_id}`);
  }
  return { error: null };
}

export async function updateInquiryStatus(id: string, status: string) {
  return updateInquiry(id, { status: status as any });
}

export async function updateInquiryPrice(id: string, price: number | null) {
  return updateInquiry(id, { price });
}

export async function updateInquiryNotes(id: string, notes: string | null) {
  return updateInquiry(id, { notes });
}

export async function getInquiriesBySupplier(supplierId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("inquiries")
    .select(
      `
      *,
      profiles (
        id,
        role
      ),
      suppliers (
        name
      ),
      products (
        notes,
        photo_hashes (
          storage_path,
          alt_text
        )
      )
    `,
    )
    .eq("supplier_id", supplierId)
    .order("created_at", { ascending: false });

  if (error) return { data: null, error: { message: error.message } };
  return { data, error: null };
}
