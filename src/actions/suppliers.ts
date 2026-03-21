'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { SupplierSchema, type SupplierFormValues } from '@/lib/schemas/supplier'

export async function createSupplier(formData: SupplierFormValues) {
  const parsed = SupplierSchema.safeParse(formData)
  if (!parsed.success) return { data: null, error: { message: 'Invalid form data.' } }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: { message: 'Unauthorized' } }

  const { data, error } = await supabase
    .from('suppliers')
    .insert({ ...parsed.data, created_by: user.id })
    .select()
    .single()

  if (error) return { data: null, error: { message: error.message } }
  revalidatePath('/suppliers')
  return { data, error: null }
}

export async function updateSupplier(id: string, formData: SupplierFormValues) {
  const parsed = SupplierSchema.safeParse(formData)
  if (!parsed.success) return { data: null, error: { message: 'Invalid form data.' } }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: { message: 'Unauthorized' } }

  const { data, error } = await supabase
    .from('suppliers')
    .update(parsed.data)
    .eq('id', id)
    .select()
    .single()

  if (error) return { data: null, error: { message: error.message } }
  revalidatePath('/suppliers')
  return { data, error: null }
}
