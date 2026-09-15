// RUN WITH pnpm dlx tsx scripts/import-catalog.ts

import { config as loadDotenv } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import {
  DEFAULT_CATALOG_IMPORT_PATH,
  type CatalogImportClient,
  getCatalogImportEnv,
  importCatalogPayload,
  loadCatalogImportFile,
} from '../src/lib/catalog-import.ts'

loadDotenv({ path: '.env.local', quiet: true })

async function main() {
  const args = process.argv.slice(2).filter((value) => value !== '--')
  const filePath = args[0] ?? DEFAULT_CATALOG_IMPORT_PATH
  const { supabaseUrl, serviceRoleKey } = getCatalogImportEnv()
  const { path, payload } = await loadCatalogImportFile(filePath)
  const supabase = createClient(supabaseUrl, serviceRoleKey) as unknown as CatalogImportClient
  const summary = await importCatalogPayload(supabase, payload)

  console.log(JSON.stringify({
    ok: true,
    path,
    ...summary,
  }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Catalog import failed.')
  process.exitCode = 1
})
