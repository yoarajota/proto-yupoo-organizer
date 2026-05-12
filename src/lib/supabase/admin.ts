import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"
import { getSupabaseServerUrl } from "@/lib/supabase/url"

export function createAdminClient() {
  return createClient<Database>(
    getSupabaseServerUrl(),
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}
// ⚠️  Server-only: never import in "use client" components
