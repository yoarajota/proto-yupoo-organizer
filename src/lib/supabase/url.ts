export function getSupabaseServerUrl() {
  return process.env.SUPABASE_SERVER_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!
}
