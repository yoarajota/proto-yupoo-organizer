"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { InviteUserSchema } from "@/lib/schemas/user"
import type { Tables } from "@/types/database"

export type Profile = Tables<"profiles"> & { email?: string }

export async function ensureProfile() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { data: null, error: null }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle()

  if (profile) return { data: profile, error: null }

  const { count } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })

  const role = count === 0 ? "admin" : "member"

  const adminClient = createAdminClient()
  const { data: newProfile, error } = await adminClient
    .from("profiles")
    .insert({ id: user.id, role, is_active: true })
    .select()
    .single()

  if (error) return { data: null, error: { message: error.message } }
  return { data: newProfile, error: null }
}

export async function getCurrentProfile() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { data: null, error: { message: "Unauthorized" } }

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  if (error) return { data: null, error: { message: error.message } }
  return { data: { ...data, email: user.email }, error: null }
}

export async function getUsers() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { data: null, error: { message: "Unauthorized" } }

  const { data: profiles, error } = await supabase.from("profiles").select("*")
  if (error) return { data: null, error: { message: error.message } }

  const adminClient = createAdminClient()
  const {
    data: { users: authUsers },
  } = await adminClient.auth.admin.listUsers()

  const emailMap = new Map(authUsers.map((u) => [u.id, u.email]))

  const usersWithEmail: Profile[] = profiles.map((p) => ({
    ...p,
    email: emailMap.get(p.id),
  }))

  return { data: usersWithEmail, error: null }
}

export async function inviteUser(formData: { email: string }) {
  const parsed = InviteUserSchema.safeParse(formData)
  if (!parsed.success) return { data: null, error: { message: "Invalid email." } }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { data: null, error: { message: "Unauthorized" } }

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!callerProfile || callerProfile.role !== "admin")
    return { data: null, error: { message: "Only admins can invite users." } }

  const adminClient = createAdminClient()
  const { data: inviteData, error: inviteError } =
    await adminClient.auth.admin.inviteUserByEmail(parsed.data.email)

  if (inviteError) return { data: null, error: { message: inviteError.message } }

  if (inviteData.user) {
    await adminClient.from("profiles").insert({
      id: inviteData.user.id,
      role: "member",
      is_active: true,
      invited_by: user.id,
    })
  }

  return { data: { email: parsed.data.email }, error: null }
}

export async function deactivateUser(userId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { data: null, error: { message: "Unauthorized" } }

  if (userId === user.id)
    return { data: null, error: { message: "Cannot deactivate yourself." } }

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!callerProfile || callerProfile.role !== "admin")
    return { data: null, error: { message: "Only admins can deactivate users." } }

  const adminClient = createAdminClient()
  const { error: updateError } = await adminClient
    .from("profiles")
    .update({ is_active: false })
    .eq("id", userId)

  if (updateError) return { data: null, error: { message: updateError.message } }

  await adminClient.auth.admin.signOut(userId)

  return { data: { deactivatedUserId: userId }, error: null }
}

export async function reactivateUser(userId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { data: null, error: { message: "Unauthorized" } }

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!callerProfile || callerProfile.role !== "admin")
    return { data: null, error: { message: "Only admins can reactivate users." } }

  const adminClient = createAdminClient()
  const { error: updateError } = await adminClient
    .from("profiles")
    .update({ is_active: true })
    .eq("id", userId)

  if (updateError) return { data: null, error: { message: updateError.message } }

  return { data: { reactivatedUserId: userId }, error: null }
}
