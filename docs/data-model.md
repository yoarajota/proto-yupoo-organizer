# Data model

Postgres 17 (`supabase/config.toml`), managed with Supabase migrations in `supabase/migrations/`. Everything below is taken from the migration SQL and cross-checked against `src/types/database.ts`. Application behavior is in [architecture.md](architecture.md).

## Migrations

- 29 files, `00110101000000_profiles.sql` to `00110101000029_mission_queue_send_validation.sql`. Name pattern: `00110101` + a 6-digit sequence + `_<slug>.sql`. Supabase orders by the numeric prefix. There is no `...000001` (sequence starts 000, then 002); numbering is otherwise contiguous.
- The comment header inside each file uses an older numbering (`-- 001_profiles.sql`, `-- 007_rls_policies.sql` in file 002, `-- 008_...` in files 007 and 010, `-- 018_...` in both 018 and 019). Trust the filename, not the header.
- Add new migrations with the next number. Apply with `npx supabase@latest db reset` (local). `supabase/config.toml` lists `./seed.sql` as the seed file but `supabase/seed.sql` does not exist in the repo.
- Extensions created: `vector` (schema `extensions`, 023), `pgmq`, `pg_cron`, `pg_net`, `supabase_vault` (025).
- Trigger function `update_updated_at()` (000) is reused by every table that has `updated_at`.

### Generated types

`src/types/database.ts` is generated, never edited by hand. Regenerate after every migration:

```bash
npx supabase@latest gen types typescript --local > src/types/database.ts
```

Redirect stdout only. The CLI prints Docker progress on stderr; if stderr ends up in the file the build breaks. A stale file also breaks `pnpm build`. (`package.json` has a `db:types` script that calls a bare `supabase` binary; use the `npx` form.)

## Enums

| Enum | Values | Migration |
| --- | --- | --- |
| `user_role` | `admin`, `member` | 000 |
| `inquiry_status` | `sent`, `price_received`, `negotiating`, `decided`, `ghosted` | 006 |
| `platform_type` | `reddit`, `discord`, `whatsapp`, `other` | 009 |
| `sourcing_mission_status` | `created`, `scanning`, `classifying_categories` (017), `matching`, `suggestions_ready`, `awaiting_approval`, `approved_for_outreach`, `replies_received`, `offers_normalized`, `completed`, `blocked_needs_input`, `failed_retrying`, `failed_terminal`, `discovery_queued`, `classification_queued`, `matching_queued`, `outreach_queued`, `parse_queued` (025) | 012, 017, 025 |
| `outreach_suggestion_status` | `pending_approval`, `approved`, `exported` | 015 |
| `supplier_message_direction` | `outbound`, `inbound` | 016 |

Some "enums" are `text` + `CHECK` instead: `discovered_categories.classification_status` (`auto_accepted`, `needs_review`, `reviewed`), `classification_method` (`rules`, `embedding`, `manual`), same pair on `mission_category_classifications`, `sourcing_mission_runs.status` (`queued`, `running`, `succeeded`, `failed`), `photo_hashes.download_status` (`pending`, `downloaded`, `failed`) and `phash_status` (`pending`, `hashed`, `failed`), `catalog_embeddings.entity_type` (`brand`, `brand_alias`, `product_type`).

## Core CRM

| Table | Migration | Key columns / notes |
| --- | --- | --- |
| `profiles` | 000, 011 | `id` = `auth.users.id` (PK, cascade), `role user_role`, `is_active`, `invited_by`. Rows are created by the app (`ensureProfile`), not a trigger. |
| `suppliers` | 003 | `name`, `yupoo_url`, `whatsapp_contact`, `trust_notes`, `is_flagged`, `red_flag_source`, `negotiation_opening_price`, `negotiation_final_price`, `created_by`. The `brands text[]` column was migrated into `supplier_brands` and dropped (020, 021). |
| `products` | 004, 020 | `notes`, `created_by`, `brand_id` -> `brands` (set null), `product_type_id` -> `product_types` (set null). |
| `photo_hashes` | 005, 028 | `product_id`, `storage_path` (path in bucket `product-photos`), `phash`, `alt_text`, `created_by`. 028 makes `product_id` and `created_by` nullable and adds `mission_id` -> `sourcing_missions` (cascade), `download_status`, `phash_status`. Rows with `mission_id` and no `product_id` come from Yupoo image ingest. |
| `similarity_matches` | 010 | `source_photo_hash_id`, `matched_photo_hash_id` (both -> `photo_hashes`, cascade), `distance int`, `is_dismissed`. |
| `inquiries` | 006 | `product_id`, `supplier_id` (cascade), `status inquiry_status` default `sent`, `price`, `notes`, `created_by`. |
| `sources` | 009 | `url`, `platform platform_type`, `brands text[]` (still free-form here), `notes`, `is_active`, `created_by`. |

Storage: bucket `product-photos` (008), public, 10 MiB limit, `image/jpeg|png|webp|gif`. Policies on `storage.objects` for role `authenticated`: insert, select, delete (delete is not restricted to the uploader despite the policy name `auth_delete_own_photos`).

Migration 011 repoints every `created_by` foreign key of suppliers, products, photo_hashes, inquiries, sources from `auth.users` to `profiles` (cascade). `sourcing_missions.created_by` and `outreach_suggestions.approved_by` reference `auth.users` directly.

Relationships: `product` 1-n `photo_hashes` 1-n `similarity_matches` (as source and as matched); `product` n-m `supplier` through `inquiries`.

## Global catalog

Admin-curated and shared by all users (024). Seeded from `data/catalog-import.json` by `scripts/import-catalog.ts`.

| Table | Migration | Notes |
| --- | --- | --- |
| `brands` | 020, 024 | `name`, `slug` (unique). `created_by` dropped in 024. |
| `product_types` | 020, 024 | `name`, `slug` (unique). `created_by` dropped in 024. |
| `brand_aliases` | 022, 024 | `brand_id` (cascade), `alias`, unique `(brand_id, alias)`. Initially seeded with each brand's own name. `created_by` dropped in 024. |
| `supplier_brands` | 020 | Join `(supplier_id, brand_id)`, both cascade. |
| `supplier_product_types` | 020 | Join `(supplier_id, product_type_id)`. |
| `catalog_embeddings` | 023 | `entity_type` (`brand` / `brand_alias` / `product_type`); exactly one of `brand_id`, `brand_alias_id`, `product_type_id` is set (CHECK), `entity_ref` (generated), `source_text`, `source_hash`, `embedding extensions.vector(384)`. Unique on `(entity_type, entity_ref, source_hash)`. No vector index is created (queries are sequential scans). |

RPC `match_catalog_embeddings(query_embedding vector(384), entity_types text[] default all three, match_threshold real default 0.7, match_count int default 5)` (023): `security definer`, `stable`; cosine similarity (`1 - (embedding <=> query)`), returns `entity_type, entity_id, canonical_slug, canonical_name, source_text, similarity`. Granted to `authenticated` and `service_role`. Used by the classification stage.

## Sourcing missions and queue

| Table | Migration | Notes |
| --- | --- | --- |
| `sourcing_missions` | 012, 018, 025 | `created_by`, `product_intent`, `objective` (default `speed`), `status`, `destination_context`, `constraints jsonb`, `seed_url` (018, not null), `first_suggestion_batch_at`, `first_valid_quote_at`. Queue/run state (025): `current_stage`, `queued_at`, `running_at`, `failed_at`, `attempt_count`, `last_error_message`, `last_error_code`, `last_queue_message_id`. |
| `sourcing_mission_stage_metrics` | 012 | Per-stage timing. `duration_ms` is a generated column (`finished_at - started_at`). Unique `(mission_id, stage_name, started_at)`. |
| `sourcing_mission_runs` | 025 | One row per queued run: `stage_name`, `status`, `attempt_number`, `queue_message_id`, timestamps, `diagnostics jsonb`, `error_message`, `error_code`. |
| `sourcing_mission_stage_events` | 025 | Append-only log: `run_id` (set null on delete), `stage_name`, `event_name`, `diagnostics jsonb`. |

Everything below `sourcing_missions` cascades on mission delete.

### Queue

- pgmq queue `mission_runs` (created in 025, guarded against duplicates). Message body written by `src/lib/mission-queue.ts`: `{ mission_id, stage, attempt, enqueued_at, payload }`.
- `pg_cron` job `invoke-mission-queue-every-minute` (`* * * * *`) calls `net.http_post` on `<project_url>/functions/v1/mission-queue` with `service_role_key`; both values are read from Vault secrets named `project_url` and `service_role_key`. Setup steps are in the README.
- RPC wrappers in `public` (026), all `security definer` with `search_path = public, pgmq, extensions`, `PUBLIC` execute revoked:
  - `mission_queue_send(queue_name text, message jsonb, sleep_seconds int default 0) -> bigint`: granted to `authenticated`, `service_role`.
  - `mission_queue_read(queue_name text, sleep_seconds int default 30, n int default 5)` -> `msg_id, read_ct, enqueued_at, vt, message`: `service_role` only.
  - `mission_queue_delete(queue_name text, msg_id bigint) -> boolean`: `service_role` only.
- 029 makes `mission_queue_send` reject any `queue_name` other than `mission_runs` and any message that is not a JSON object with `mission_id` and `stage`. `mission_queue_read` and `mission_queue_delete` are `service_role` only. Any authenticated user can still enqueue a well-formed message for any mission id; ownership of the mission is not checked in the RPC.
- Consumer: `supabase/functions/mission-queue/index.ts`; flow is in [architecture.md](architecture.md#queue-path).

## Sourcing pipeline data

| Table | Migration | Notes |
| --- | --- | --- |
| `discovered_categories` | 013, 017, 019 | Per mission: `source_url`, `category_path text[]`, `confidence`; unique `(mission_id, source_url, category_path)`. 017 adds `raw_label`, `normalized_label`, `brand_signal`, `product_signal`, `classification_status`, `classification_confidence`, `classification_method`. 019 adds `preview_image_urls text[]`. |
| `discovered_suppliers` | 013, 017 | Per mission: `supplier_key`, `source_url`, `category_refs text[]`, `last_seen_at`, `confidence`; unique `(mission_id, supplier_key, source_url)`. 017 adds `normalized_category_refs text[]` (derived from classified categories). |
| `mission_category_classifications` | 017 | One row per `(mission_id, source_category_id)` (unique): `canonical_brand`, `canonical_product_type`, `display_label`, `evidence jsonb`, status/confidence/method. `source_category_id` -> `discovered_categories` (cascade). Deleted when a review rejects a category. |
| `mission_supplier_matches` | 014 | `(mission_id, supplier_id)` unique; `rank_score numeric(8,4)`, `rank_reasons jsonb`. `supplier_id` -> `discovered_suppliers`. |
| `outreach_suggestions` | 015 | `(mission_id, supplier_id)` unique; `channel_hint` (default `whatsapp`), `language` (default `en`), `message_text`, `status outreach_suggestion_status`, `approved_by`, `approved_at`, `exported_at`. |
| `supplier_messages` | 016 | `direction`, `channel`, `body`, `received_or_sent_at`. Inbound replies are inserted by `ingestInboundMessage`. |
| `normalized_offers` | 016 | `(mission_id, supplier_id)` unique; `unit_price`, `currency`, `moq`, `lead_time`, `terms_notes`, `extraction_confidence`. |
| `catalogue_summaries` | 016 | `(mission_id, supplier_id)` unique; `catalogue_requested_at`, `catalogue_received_at`, `summary_text`, `summary_confidence`. |

`discovered_suppliers` are mission-scoped records, distinct from the CRM `suppliers` table; nothing in the migrations links the two.

Mission-scoped image similarity (028): `photo_hashes` rows with `mission_id` set, hashed by `/api/phash` into `similarity_matches`. A partial index `photo_hashes_phash_status_idx` covers `phash_status = 'pending'` rows for retries. The 028 file name mentions "category strategy", but the file contains only the similarity changes; the category-strategy roll-up is computed in code (`rollupCategoryStrategy`) and stored only as a stage event (`worker_classification_strategy_rolled_up`).

## Key relationships

```
auth.users 1-1 profiles
profiles 1-n suppliers | products | photo_hashes | inquiries | sources     (created_by)
products 1-n photo_hashes 1-n similarity_matches
products n-m suppliers via inquiries
brands 1-n brand_aliases;  brands/product_types 1-n products;  suppliers n-m brands/product_types (join tables)
brands | brand_aliases | product_types 1-n catalog_embeddings
sourcing_missions 1-n { stage_metrics, runs 1-n stage_events, discovered_categories, discovered_suppliers,
                        mission_category_classifications, mission_supplier_matches, outreach_suggestions,
                        supplier_messages, normalized_offers, catalogue_summaries, photo_hashes }
discovered_categories 1-1 mission_category_classifications
discovered_suppliers 1-n { mission_supplier_matches, outreach_suggestions, supplier_messages, normalized_offers, catalogue_summaries }
```

## RLS approach

RLS is enabled on every table; each migration enables it and defines policies in the same file.

- Helper `is_admin()` (002): `security definer`, `stable`; true when the caller's active profile has role `admin`. `security definer` avoids recursion when policies read `profiles`.
- CRM tables (`suppliers`, `products`, `photo_hashes`, `inquiries`, `sources`): any authenticated user can read and insert; update/delete only for `created_by = auth.uid()` or admin. Exceptions: `photo_hashes` has no update policy, `similarity_matches` has no insert or delete policy (read for all, update of `is_dismissed` for the source photo's creator or admin).
- `profiles`: any authenticated user can read; only admins insert/update.
- Sourcing tables: `sourcing_missions` is readable and insertable by any authenticated user, with update/delete limited to the creator or admin. Every other mission-scoped table (`sourcing_mission_stage_metrics` and all discovery, classification, matching, outreach and inbound tables) gives any authenticated user full read/insert/update/delete, not scoped to the mission owner.
- `sourcing_mission_runs` and `sourcing_mission_stage_events` (025): authenticated read; writes for `service_role` only. Exception (027): authenticated users may insert `sourcing_mission_runs` rows with `status = 'queued'` for missions they created.
- Global catalog (`brands`, `product_types`, `brand_aliases`; 024): authenticated read; insert/update/delete admin only. `supplier_brands` / `supplier_product_types`: read for authenticated, `for all` for the parent supplier's creator or admin.
- `catalog_embeddings`: RLS enabled with no policies, so only `service_role` (bypasses RLS) and the `security definer` RPC can access it.
- The service-role client (`src/lib/supabase/admin.ts`) bypasses RLS: profile bootstrap, `/api/mission-worker`, and the catalog scripts.

Gaps found while reading the policies (not verified at runtime):

- `photo_hashes` has no UPDATE policy and `similarity_matches` has no INSERT policy for any role except `service_role`, which is fine because `/api/phash` now writes through the service-role client (see [architecture.md](architecture.md#image-similarity-phash)).
- 028's `Auth users can read mission-scoped photo_hashes` policy is redundant with 005's read policy (`auth.uid() is not null`).
- `sourcing_mission_stage_events` cannot be written by the user-session client, which matters for the inline execution path.
