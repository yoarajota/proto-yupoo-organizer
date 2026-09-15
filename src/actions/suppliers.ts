'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { SupplierSchema, type SupplierFormValues } from '@/lib/schemas/supplier'

async function replaceSupplierCatalogLinks(
  supabase: Awaited<ReturnType<typeof createClient>>,
  supplierId: string,
  brandIds: string[],
  productTypeIds: string[],
) {
  const [deleteBrands, deleteProductTypes] = await Promise.all([
    supabase.from('supplier_brands').delete().eq('supplier_id', supplierId),
    supabase.from('supplier_product_types').delete().eq('supplier_id', supplierId),
  ])

  if (deleteBrands.error) throw new Error(deleteBrands.error.message)
  if (deleteProductTypes.error) throw new Error(deleteProductTypes.error.message)

  if (brandIds.length > 0) {
    const { error } = await supabase
      .from('supplier_brands')
      .insert(brandIds.map((brand_id) => ({ supplier_id: supplierId, brand_id })))
    if (error) throw new Error(error.message)
  }

  if (productTypeIds.length > 0) {
    const { error } = await supabase
      .from('supplier_product_types')
      .insert(productTypeIds.map((product_type_id) => ({ supplier_id: supplierId, product_type_id })))
    if (error) throw new Error(error.message)
  }
}

export async function createSupplier(formData: SupplierFormValues) {
  const parsed = SupplierSchema.safeParse(formData)
  if (!parsed.success) return { data: null, error: { message: 'Invalid form data.' } }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: { message: 'Unauthorized' } }

  const { brand_ids, product_type_ids, ...supplierValues } = parsed.data
  const brandIds = brand_ids ?? []
  const productTypeIds = product_type_ids ?? []

  const { data, error } = await supabase
    .from('suppliers')
    .insert({ ...supplierValues, created_by: user.id })
    .select()
    .single()

  if (error) return { data: null, error: { message: error.message } }

  if (brandIds.length > 0 || productTypeIds.length > 0) {
    try {
      await replaceSupplierCatalogLinks(supabase, data.id, brandIds, productTypeIds)
    } catch (linkError) {
      return { data: null, error: { message: linkError instanceof Error ? linkError.message : 'Failed to link catalog items.' } }
    }
  }

  revalidatePath('/workspace')
  return { data, error: null }
}

export async function updateSupplier(id: string, formData: SupplierFormValues) {
  const parsed = SupplierSchema.safeParse(formData)
  if (!parsed.success) return { data: null, error: { message: 'Invalid form data.' } }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: { message: 'Unauthorized' } }

  const { brand_ids, product_type_ids, ...supplierValues } = parsed.data
  const brandIds = brand_ids ?? []
  const productTypeIds = product_type_ids ?? []
  const shouldReplaceCatalogLinks = brand_ids !== undefined || product_type_ids !== undefined

  const { data, error } = await supabase
    .from('suppliers')
    .update(supplierValues)
    .eq('id', id)
    .select()
    .single()

  if (error) return { data: null, error: { message: error.message } }

  if (shouldReplaceCatalogLinks) {
    try {
      await replaceSupplierCatalogLinks(supabase, id, brandIds, productTypeIds)
    } catch (linkError) {
      return { data: null, error: { message: linkError instanceof Error ? linkError.message : 'Failed to link catalog items.' } }
    }
  }

  revalidatePath('/workspace')
  revalidatePath('/suppliers/' + id)
  return { data, error: null }
}
