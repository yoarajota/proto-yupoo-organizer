"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  SourceCreateSchema,
  type SourceCreateValues,
} from "@/lib/schemas/source";

export async function createSource(values: SourceCreateValues) {
  const parsed = SourceCreateSchema.safeParse(values);
  if (!parsed.success) {
    return { data: null, error: { message: "Invalid source data" } };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: { message: "Unauthorized" } };

  const { data, error } = await supabase
    .from("sources")
    .insert({
      ...parsed.data,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return { data: null, error: { message: error.message } };

  revalidatePath("/workspace");
  return { data, error: null };
}

export async function toggleSourceActive(id: string, isActive: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: { message: "Unauthorized" } };

  const { data, error } = await supabase
    .from("sources")
    .update({ is_active: isActive })
    .eq("id", id)
    .select()
    .single();

  if (error) return { data: null, error: { message: error.message } };

  revalidatePath("/workspace");
  return { data, error: null };
}
