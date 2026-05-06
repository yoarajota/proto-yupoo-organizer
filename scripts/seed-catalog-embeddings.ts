import { config as loadDotenv } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import {
  getCatalogEmbeddingSeedEnv,
  seedCatalogEmbeddings,
} from '../src/lib/catalog-embeddings-seed.ts'

loadDotenv({ path: '.env.local', quiet: true })

async function main() {
  const { supabaseUrl, serviceRoleKey } = getCatalogEmbeddingSeedEnv()
  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const summary = await seedCatalogEmbeddings(supabase)

  console.log(JSON.stringify({
    ok: true,
    ...summary,
  }, null, 2))
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : 'Catalog embedding seed failed.',
  )
  process.exitCode = 1
})
