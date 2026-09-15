"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { toSlug } from "@/lib/catalog"
import {
  BrandAliasSchema,
  CatalogItemSchema,
  type BrandAliasValues,
  type CatalogItemValues,
} from "@/lib/schemas/catalog"

type CatalogTable = "brands" | "product_types"

async function requireAdminCatalogAccess() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { supabase: null, error: { message: "Unauthorized" } }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (error) return { supabase: null, error: { message: error.message } }
  if (profile.role !== "admin") {
    return { supabase: null, error: { message: "Only admins can manage catalog entries." } }
  }

  return { supabase, error: null }
}

async function createCatalogItem(table: CatalogTable, values: CatalogItemValues) {
  const parsed = CatalogItemSchema.safeParse(values)
  if (!parsed.success) return { data: null, error: { message: "Invalid form data." } }

  const access = await requireAdminCatalogAccess()
  if (access.error) return { data: null, error: access.error }

  const name = parsed.data.name
  const slug = toSlug(name)
  if (!slug) return { data: null, error: { message: "Name must include letters or numbers." } }

  const { data, error } = await access.supabase
    .from(table)
    .insert({ name, slug })
    .select()
    .single()

  if (error) return { data: null, error: { message: error.message } }

  revalidatePath("/workspace")
  return { data, error: null }
}

export async function createBrand(values: CatalogItemValues) {
  return createCatalogItem("brands", values)
}

export async function createProductType(values: CatalogItemValues) {
  return createCatalogItem("product_types", values)
}

export async function createBrandAlias(values: BrandAliasValues) {
  const parsed = BrandAliasSchema.safeParse(values)
  if (!parsed.success) return { data: null, error: { message: "Invalid form data." } }

  const access = await requireAdminCatalogAccess()
  if (access.error) return { data: null, error: access.error }

  const alias = parsed.data.alias

  const { data, error } = await access.supabase
    .from("brand_aliases")
    .insert({
      brand_id: parsed.data.brand_id,
      alias,
    })
    .select()
    .single()

  if (error) return { data: null, error: { message: error.message } }

  revalidatePath("/workspace")
  return { data, error: null }
}
