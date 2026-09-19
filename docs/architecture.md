# Architecture

Next.js 16 App Router app on Supabase (Postgres, Auth, Storage, Queues/pgmq, Edge Functions). Next 16 conventions differ from older versions (for example `src/proxy.ts` replaces `middleware.ts`); check `node_modules/next/dist/docs/` before changing framework-level code, per `AGENTS.md`.

Everything below was checked against the code at the time of writing. Items that could not be confirmed by reading code are marked "unverified". Schema details live in [data-model.md](data-model.md).

## Layering

```
src/app (routes, RSC pages)  ->  src/actions (server actions)  ->  src/lib (logic)  ->  src/lib/supabase (clients)
src/components (UI)          ->  src/actions (mutations only)     src/lib/schemas (zod, shared by all layers)
```

| Layer | Path | Role |
| --- | --- | --- |
| Routes | `src/app` | Server components read data directly through `createClient()` (e.g. `src/app/(app)/workspace/data.ts`); mutations go through server actions. |
| Server actions | `src/actions/*.ts` (`'use server'`) | Validate input with a zod schema, call `supabase.auth.getUser()` (return `Unauthorized` when absent), run one Supabase operation or delegate to `src/lib`, `revalidatePath`. Return `{ data, error }`. |
| Logic | `src/lib` | Pure or Supabase-client-injected logic. Mission pipeline: `mission-stage-runner.ts`, `mission-queue.ts`, `mission-status.ts`, `yupoo/*`. Catalog: `catalog*.ts`, `catalog-embeddings*.ts`. Similarity: `phash-utils.ts`. |
| Supabase clients | `src/lib/supabase/` | `server.ts` (cookie-bound, anon key, RLS applies), `client.ts` (browser), `admin.ts` (service-role, bypasses RLS), `storage.ts` (`getImageBuffer` for bucket `product-photos`), `url.ts` (`SUPABASE_SERVER_URL` overrides `NEXT_PUBLIC_SUPABASE_URL` server-side, used for Docker). |
| Schemas | `src/lib/schemas/*.ts` | zod 4 schemas and inferred types, one file per domain (`sourcing-*.ts`, `supplier.ts`, `product.ts`, `inquiry.ts`, `source.ts`, `catalog.ts`, `user.ts`, `group.ts`). `group.ts` holds `LoginSchema`. |
| DB types | `src/types/database.ts` | Generated; see [data-model.md](data-model.md#generated-types). |

Admin (service-role) client is used only in `src/actions/users.ts` (profile bootstrap, invite, deactivate) and `src/app/api/mission-worker/route.ts`.

Naming quirk: `src/actions/groups.ts` contains `signIn`, `signOut`, `signOutAndRedirect` (auth), not group management.

## Auth and `src/proxy.ts`

- `proxy()` builds an `@supabase/ssr` server client from request cookies, calls `auth.getUser()` (not `getSession()`), and redirects to `/login` when there is no user, the path does not start with `/login`, and the request is not a server action (`POST` with `next-action` header).
- Server actions are therefore not gated by the proxy; each action re-checks the user itself.
- `config.matcher` excludes anything starting with `api`, `_next/static`, `_next/image`, `favicon.ico` and common image extensions. `src/app/api/*` is never behind the proxy: `/api/mission-worker` is protected by a bearer token.
- `UI_PREVIEW_MODE=1` (`src/lib/preview.ts`) short-circuits the proxy and several pages/layouts to render fixture data without Supabase.
- Profiles are created lazily: `ensureProfile()` (called from `src/app/(app)/layout.tsx`) inserts a `profiles` row via the admin client; the first profile becomes `admin`, later ones `member`. No DB trigger on `auth.users` exists in the migrations.
- `scripts/create-admin-user.ts` creates a hard-coded local admin account (`admin@example.com`); local use only.

## Route map (`src/app`)

| Route | File | Notes |
| --- | --- | --- |
| `/` | `page.tsx` | Redirects to `/workspace`. |
| `/login` | `(auth)/login/page.tsx`, `LoginForm.tsx` | `(auth)/layout.tsx` is a passthrough. |
| `/workspace` | `(app)/workspace/page.tsx` | `UnifiedWorkspace` on the default section `missions`. |
| `/workspace/[section]` | `(app)/workspace/[section]/page.tsx` | Sections (from `components/organisms/workspace-sections.ts`): `missions`, `catalog`, `inquiries`, `suppliers`, `products`, `sources`; anything else is `notFound()`. |
| `/workspace/missions/new` | `.../missions/new/page.tsx` | `MissionCreationWorkspace`. |
| `/workspace/review` | `.../review/page.tsx` | `ReviewWorkspace`, an overview dashboard of missions/inquiries/suppliers/products/sources. It is not the category-review UI (see pipeline notes). |
| `/missions/[id]` | `(app)/missions/[id]/page.tsx` | Mission diagnostics: `sourcing_mission_runs`, stage events, formatted by `src/lib/mission-display.ts`. |
| `/products/[id]`, `/suppliers/[id]` | `(app)/...` | Detail pages (`DetailTemplate`). |
| `/settings` | `(app)/settings/page.tsx` | User list, invite, activate/deactivate (`actions/users.ts`). |
| `POST /api/mission-worker` | `api/mission-worker/route.ts` | Stage executor; see queue path. |

`(app)/workspace/data.ts` (`getWorkspaceData`) is the shared loader for all workspace pages. `(app)/layout.tsx` wraps pages in `AppShell` + `TopBar` and calls `ensureProfile()`.

## Component layering (`src/components`)

Atomic Design, enforced by convention only (no lint rule found):

- `atoms/`: `PhotoThumb`, `PriceRange`, `BrandTagChip`, `AttributionLine`, `RedFlagIcon`.
- `molecules/`: inputs, badges, banners, dropdowns (`BrandTagInput`, `StatusDropdown`, `CatalogAutocomplete`, `SimilarityAdvisoryBanner`, ...).
- `organisms/`: tables, sheets, rows, workspaces (`UnifiedWorkspace`, `MissionsTable`, `CatalogManager`, `ReviewWorkspace`, `SideNav`, `TopBar`, ...). Organisms are where server actions are imported (for example `MissionsTable` -> `sourcing-discovery`/`sourcing-classification`, `CatalogManager` -> `catalog`).
- `templates/`: `AppShell`, `DetailTemplate`, `GalleryTemplate`.
- `ui/`: shadcn/ui primitives (`components.json`, style `base-nova`, built on `@base-ui/react`), Tailwind 4.

Unit tests are colocated (`*.test.ts(x)`, Vitest + jsdom, setup in `src/test/setup.ts`).

## Sourcing mission pipeline

A mission (`sourcing_missions`, created by `createSourcingMission` in `src/actions/sourcing-missions.ts`) has a Yupoo `seed_url` and moves through stages. A stage name is a `MissionStage` (`src/lib/mission-status.ts`): `discovery`, `classifying_categories`, `matching`, `suggestion_generation`, `parse`.

| Stage | Server action(s) | Executor (`src/lib/mission-stage-runner.ts`) | Pure logic | Writes | Status after |
| --- | --- | --- | --- | --- | --- |
| Discovery | `sourcing-discovery.ts` (`runMissionDiscovery`, `executeMissionDiscoveryDirect`, `runMissionDiscoveryWithFallback`) | `executeMissionDiscoveryStage` | `yupoo/scout.ts` (`scrapeYupooDiscovery`, `extractDiscoveryFromHtml`), `yupoo/yupoo-images.ts` | `discovered_categories`, `discovered_suppliers`, `photo_hashes` (+ bucket files), stage metrics | `completed` |
| Classification | `sourcing-classification.ts` (`runMissionCategoryClassification`, `...Direct`, `...WithFallback`) | `executeMissionCategoryClassificationStage` | `yupoo/classification.ts`, `yupoo/category-config.ts`, `yupoo/supplier-refs.ts`, `catalog-embeddings.ts`, `mission-category-review.ts` | `discovered_categories` (signals/status), `mission_category_classifications`, `discovered_suppliers.normalized_category_refs`, `storage/agent-logs/classification/*.json` | `completed` |
| Category review | `reviewMissionCategoryClassification`, `getMissionReviewQueue` in `sourcing-classification.ts` | none (runs in the action) | `mission-category-review.ts` | manual decision on `discovered_categories` and `mission_category_classifications`; may insert a `brand_aliases` row | `completed` |
| Matching | `sourcing-matching.ts` (`runMissionMatching`, `executeMissionMatchingDirect`) | `executeMissionMatchingStage` | `yupoo/match.ts` (`rankSuppliersForMission`) | `mission_supplier_matches` | `suggestions_ready` |
| Outreach | `sourcing-outreach.ts` (`generateOutreachSuggestions`, `executeOutreachSuggestionsDirect`, `approveOutreachSuggestion`, `exportOutreachSuggestion`) | `executeOutreachSuggestionsStage` (stage `suggestion_generation`) | `yupoo/outreach.ts` (`buildOutreachMessage`, a text template) | `outreach_suggestions` (`pending_approval` -> `approved` -> `exported`) | `awaiting_approval` |
| Inbound / parse | `sourcing-inbound.ts` (`ingestInboundMessage`, `parseInboundOffers`, `executeInboundOfferParsingDirect`) | `executeInboundOfferParsingStage` (stage `parse`) | `yupoo/inbound.ts` (`parseInboundMessage`, regex extraction) | `supplier_messages`, `normalized_offers`, `catalogue_summaries` | `offers_normalized` |

Behavior worth knowing:

- Discovery crawls at most `MISSION_DISCOVERY_MAX_REQUESTS` (default and cap 24) pages of the shop (`/categories` first, then album/category links; defaults: depth 2, concurrency 4 via `YUPOO_DISCOVERY_CONCURRENCY` 1-8, 15 s timeout, 2 retries). An `html_snapshot` payload skips the network. It then downloads up to 24 preview images (`photo.yupoo.com` needs a shop Referer and browser UA), stores them in bucket `product-photos` under `missions/<mission_id>/`, inserts `photo_hashes` rows, and hashes them with `computePhotoHash`.
- Classification is rule-first (aliases from `category-config.ts` merged with DB `brands`/`brand_aliases`/`product_types`), then falls back to embedding lookup through the `match_catalog_embeddings` RPC (thresholds 0.70 brand, 0.76 product). Result per category is `auto_accepted` or `needs_review`; `reviewed` is set by manual review. Method is `rules`, `embedding` or `manual`.
- Matching is a deterministic weighted score (normalized signal overlap 0.4, brand overlap 0.15, raw keyword overlap 0.2, supplier confidence 0.15, freshness 0.1); there is no LLM call anywhere in the pipeline (verified by reading the stage code; no LLM SDK in `package.json`).
- Category review's alias learning (`brand_aliases` insert in `reviewMissionCategoryClassification`) still sends `created_by`, a column dropped by migration 024, and inserts are admin-only after 024. The insert is best-effort and its error is ignored, so alias learning does not persist (derived from code and migrations; not run).
- Inbound parsing is regex-based (`Price=`, MOQ, lead time, catalogue keywords). Messages must be inserted first (`ingestInboundMessage`); nothing in the repo receives supplier replies automatically.
- Only two stages are wired to UI buttons: discovery and classification (`MissionsTable`). Category review, matching, outreach, and inbound actions have no callers outside `src/actions` and tests (checked by searching `src`), so those stages are reachable only by calling the actions directly. The README describes the whole flow as a feature; treat matching onward as backend-only.
- `mission-status.ts` defines an allowed-transition table (`canTransitionMissionStatus`, `assertMissionStatusTransition`) and tests for it, but no runtime code calls it. Status writes are unguarded.
- Status values: see `sourcing_mission_status` in [data-model.md](data-model.md#sourcing-missions-and-queue). The stage-to-status maps are `missionStageRunningStatus` and `missionStageQueuedStatus`.
- Stage metrics (`sourcing_mission_stage_metrics`) are written by the runner in both execution modes.

### Execution modes

Server actions choose between two paths for discovery and classification (`run...WithFallback`; identical logic in `sourcing-discovery.ts` and `sourcing-classification.ts`):

1. Inline if `MISSION_RUN_INLINE=true`, or unset while `NODE_ENV=development` (`false` forces the queue). The action calls `execute...Direct`, which runs the stage inside the request using the user's cookie-bound client (RLS applies).
2. Otherwise, if `MISSION_WORKER_URL` and `MISSION_WORKER_TOKEN` are set, it enqueues. If enqueue succeeded but processor invocation failed (`processor_invoked === false`), it falls back to inline.
3. Otherwise inline.

Matching, outreach, and inbound only expose the enqueue action and a separate `...Direct` action; there is no automatic fallback function for them.

### Queue path

```
server action -> enqueueMissionStage (src/lib/mission-queue.ts)
   1. read mission attempt_count
   2. RPC mission_queue_send  -> pgmq queue `mission_runs`
   3. update sourcing_missions (status = *_queued, current_stage, queued_at, attempt_count, last_queue_message_id)
   4. insert sourcing_mission_runs (status = queued)
   5. supabase.functions.invoke('mission-queue')          (name from SUPABASE_MISSION_PROCESSOR_FUNCTION)
pg_cron `invoke-mission-queue-every-minute` -> pg_net POST /functions/v1/mission-queue   (catch-up; secrets from Vault)

Edge function supabase/functions/mission-queue/index.ts (Deno, service role)
   read up to MISSION_QUEUE_BATCH_SIZE (default 5) via RPC mission_queue_read
   per message: skip+delete if mission gone; set mission status to running status; mark run running;
   POST {stage, payload} to MISSION_WORKER_URL with Bearer MISSION_WORKER_TOKEN (timeout MISSION_WORKER_TIMEOUT_MS, default 120000)
   success -> run succeeded, events, delete message
   failure -> mission status failed_retrying, run failed, event; message is left in the queue

Next.js POST /api/mission-worker (src/app/api/mission-worker/route.ts)
   check Bearer token (MISSION_WORKER_TOKEN) -> parseMissionWorkerPayload -> executeMissionStage(admin client, stage, payload)
```

Notes on the queue path:

- The worker runs stages with the service-role client, so RLS does not apply there; inline runs use the user client. `sourcing_mission_stage_events` only allows writes for `service_role` (migration 025), so in inline mode `recordMissionStageEvent` inserts are rejected by RLS and only logged with `console.error` (inferred from policies; not run). Inline runs also create no `sourcing_mission_runs` rows, so the `/missions/[id]` diagnostics page is populated only by queued runs.
- The edge function reads with `sleep_seconds: 0` (visibility timeout 0). By pgmq semantics a failed message becomes visible again immediately, so it is retried on the next cron tick, and a message still being processed could be read by an overlapping invocation. The function has no maximum-attempt logic and never sets `failed_terminal`. pgmq semantics here are unverified against the installed extension version.
- `MISSION_WORKER_URL` seen from the Edge Runtime container must reach the Next server (see README, "Local queue testing", for host/WSL addressing). Do not duplicate it here.
- Env vars are listed in `.env.example` and `supabase/.env.example`. Read by code but absent from it: `MISSION_RUN_INLINE`, `YUPOO_DISCOVERY_CONCURRENCY`, `UI_PREVIEW_MODE`, `MISSION_WORKER_TIMEOUT_MS` (only in `supabase/.env.example`).

## Catalog: import and embeddings

- Tables `brands`, `brand_aliases`, `product_types` are a global, admin-curated catalog. Seed source: `data/catalog-import.json`.
- `pnpm catalog:import [-- <file>]` -> `scripts/import-catalog.ts` -> `src/lib/catalog-import.ts` (`importCatalogPayload`): idempotent by slug; inserts missing brands, aliases and product types, updates names that changed. Requires `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (loaded from `.env.local`).
- `pnpm catalog:embeddings:seed` -> `scripts/seed-catalog-embeddings.ts` -> `src/lib/catalog-embeddings-seed.ts` (`seedCatalogEmbeddings`): rebuilds `catalog_embeddings` for every brand, alias and product type, upserting on `(entity_type, entity_ref, source_hash)` and deleting rows whose source hash no longer matches.
- The "embedding" is not a learned model: `src/lib/catalog-embeddings.ts` cleans text (leetspeak, masking, promo tokens), hashes character trigrams into 384 dimensions, and L2-normalizes. It is deterministic and computed in-process; the same function embeds the query at classification time. Cosine search is done in SQL by `match_catalog_embeddings`.
- Re-run the embeddings seed after any catalog change; classification reads the DB, not the JSON file.
- `pnpm harvest:brand-aliases` (`scripts/harvest-brand-aliases.ts`) mines alias candidates from `discovered_categories` and prints JSON; it writes nothing to the DB. A curator merges approved aliases into `data/catalog-import.json` by hand.
- In the UI, `CatalogManager` calls `createBrand`, `createBrandAlias`, `createProductType` (`src/actions/catalog.ts`); RLS restricts writes to admins.

## Image similarity (pHash)

- Upload flow: `PhotoUploadZone` uploads from the browser client to bucket `product-photos` (`products/<id>-<name>`), then `createProduct` / `addProductPhoto` (`src/actions/products.ts`) insert a `photo_hashes` row with `phash_status = 'pending'` and fire `computePhotoHash` (`src/lib/phash-utils.ts`) without awaiting it, in the same server process. If it fails the row is marked `failed`. `retryPendingPhotoHashes` (action + lib) re-triggers pending rows; discovery also calls it for the mission.
- `computePhotoHash(storagePath, photoHashId)`: downloads the image from storage, computes a 64-bit hash with `sharp-phash`, updates `photo_hashes` (`phash`, `phash_status = 'hashed'`; `failed` on error), then compares against every other non-null hash using Hamming distance (`src/lib/phash-utils.ts`) and inserts `similarity_matches` for distance <= 10. The comparison is a full table scan run inside the calling server process, not an index lookup, so it will not scale to a large `photo_hashes` table or to hosting with short request time limits.
- UI reads: `getPhotoHashStatus`, `getSimilarityMatches`, `dismissSimilarityMatch` (`products.ts`); banner in `SimilarityAdvisoryBanner`.
- Auth: `computePhotoHash` reads storage and writes `photo_hashes` / `similarity_matches` with the service-role client (`src/lib/supabase/admin.ts`), so the missing UPDATE and INSERT RLS policies for authenticated users do not matter. There is no HTTP endpoint for it. Unit tests cover the hash, match and failure paths with mocked clients; it has not been run end to end against real storage.

## Scrape evaluation scripts (`scripts/`)

Offline harness for tuning `src/lib/yupoo/scout.ts` against real shops; not used by the app at runtime. Input: `data/yupoo-shop-eval.json` (shop URLs with expectations; parsed by `parseYupooShopEvalInput` in `src/lib/yupoo/scrape-eval.ts`). Output: `storage/codex-loop/yupoo-scrape-runs/<timestamp>/` (git-ignored).

| Script | Command | Does |
| --- | --- | --- |
| `run-yupoo-scrape-eval.ts` | `pnpm scrape:eval [-- <input.json> --max-requests N]` | Runs `scrapeYupooDiscovery` per shop, classifies labels with catalog brands from `data/catalog-import.json`, writes `artifacts/<shop>.json`, `summary.jsonl`, `run-metadata.json`, and `latest.txt`. |
| `analyze-yupoo-scrape-eval.ts` | `pnpm scrape:eval:analyze -- <run_dir>` | Aggregates `summary.jsonl` into `analysis-report.json` (failure clusters, missing previews, blocked pages). |
| `compare-yupoo-scrape-eval.ts` | `pnpm scrape:eval:compare -- <prev_dir> <cur_dir>` | Writes `comparison-report.json`; accepts a run only if tests passed, no previously passing shop regressed, and a failure cluster improved. |
| `run-yupoo-scrape-eval-loop.ts` | `pnpm scrape:eval:loop [-- <input> --previous <dir>]` | Chains the three above plus `pnpm test:run src/lib/yupoo/scout.test.ts`, compares with the previous run (`latest.txt`), and writes `codex-report.md` and `loop-results.json`. It shells out to `pnpm`. |

Other scripts: `import-catalog.ts`, `seed-catalog-embeddings.ts`, `harvest-brand-aliases.ts` (above), `create-admin-user.ts`.

Scripts run with `node --experimental-strip-types` (see `package.json`), which is why `src/lib` files imported by scripts use relative `.ts` imports (for example `src/lib/yupoo/scout.ts`) instead of the `@/` alias.

## Running and testing

Setup, scripts table, catalog import, and local queue testing are in the [README](../README.md). Only additions here:

- Tests are colocated under `src/**` (`vitest.config.ts` includes `src/**/*.{test,spec}.{ts,tsx}`); run `pnpm test:run`. The single Playwright spec is `e2e/auth.spec.ts` (`pnpm e2e`).
- Mission stage code takes an injected Supabase-like client (`SupabaseAdminClient` type in `mission-stage-runner.ts`), so stages can be exercised with fakes; see `src/lib/mission-stage-runner.test.ts` and `src/app/api/mission-worker/route.test.ts`.
