"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { toSlug } from "@/lib/catalog"
import { CatalogItemSchema, type CatalogItemValues } from "@/lib/schemas/catalog"

type CatalogTable = "brands" | "product_types"

async function createCatalogItem(table: CatalogTable, values: CatalogItemValues) {
  const parsed = CatalogItemSchema.safeParse(values)
  if (!parsed.success) return { data: null, error: { message: "Invalid form data." } }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { data: null, error: { message: "Unauthorized" } }

  const name = parsed.data.name
  const slug = toSlug(name)
  if (!slug) return { data: null, error: { message: "Name must include letters or numbers." } }

  const { data, error } = await supabase
    .from(table)
    .insert({ name, slug, created_by: user.id })
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
