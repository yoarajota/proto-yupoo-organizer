"use server"

import { createClient } from "@/lib/supabase/server"
import { LoginSchema } from "@/lib/schemas/group"

export async function signIn(formData: { email: string; password: string }) {
  const parsed = LoginSchema.safeParse(formData)
  if (!parsed.success) {
    return { data: null, error: { message: "Invalid email or password format." } }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) return { data: null, error: { message: error.message } }
  if (!data.session) return { data: null, error: { message: "Sign-in succeeded but no session was created." } }
  return { data: data.session, error: null }
}

export async function signOut() {
  const supabase = await createClient()
  const { error } = await supabase.auth.signOut()
  if (error) return { data: null, error: { message: error.message } }
  return { data: null, error: null }
}
