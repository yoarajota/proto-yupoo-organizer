'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { ProductUpdateValues } from '@/lib/schemas/product'

export async function createProduct(storagePath: string, altText: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: { message: 'Unauthorized' } }

  const { data: product, error: productError } = await supabase
    .from('products')
    .insert({ created_by: user.id })
    .select()
    .single()

  if (productError || !product) {
    return { data: null, error: { message: productError?.message ?? 'Failed to create product' } }
  }

  const { data: hash, error: hashError } = await supabase
    .from('photo_hashes')
    .insert({ product_id: product.id, storage_path: storagePath, alt_text: altText, created_by: user.id })
    .select()
    .single()

  if (hashError) {
    await supabase.storage.from('product-photos').remove([storagePath])
    return { data: null, error: { message: hashError.message } }
  }

  revalidatePath('/products')
  return { data: { product, hash }, error: null }
}

export async function addProductPhoto(productId: string, storagePath: string, altText: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: { message: 'Unauthorized' } }

  const { data: hash, error: hashError } = await supabase
    .from('photo_hashes')
    .insert({ product_id: productId, storage_path: storagePath, alt_text: altText, created_by: user.id })
    .select()
    .single()

  if (hashError) {
    await supabase.storage.from('product-photos').remove([storagePath])
    return { data: null, error: { message: hashError.message } }
  }

  revalidatePath('/products')
  revalidatePath(`/products/${productId}`)
  return { data: hash, error: null }
}

export async function updateProduct(productId: string, values: ProductUpdateValues) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: { message: 'Unauthorized' } }

  const { data, error } = await supabase
    .from('products')
    .update({ notes: values.notes })
    .eq('id', productId)
    .select()
    .single()

  if (error) return { data: null, error: { message: error.message } }
  if (!data) return { data: null, error: { message: 'Permission denied — only the product creator can edit notes' } }
  // Note: updated_at auto-set by products_updated_at trigger (DO NOT manually set it)
  revalidatePath('/products')
  revalidatePath(`/products/${productId}`)
  return { data, error: null }
}
