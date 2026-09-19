# Proto Yupoo Organizer

Sourcing and supplier-management tool for importers working with Yupoo shops: discover shops, classify their catalogs by brand and product type, match products across shops, run supplier outreach, and track inquiries and offers.

## Features

- Product catalog with image similarity detection (pHash matching)
- Supplier management with inquiry history and active-inquiry tracking
- Source library with filtering, and group-based organization
- Sourcing missions: Yupoo discovery and category classification are wired to the UI. Category review, supplier matching, outreach suggestions and inbound offer parsing exist as server actions and tests but have no UI callers yet (see [Architecture](docs/architecture.md))
- Global brand / product-type catalog with embeddings
- Supabase authentication and data

## Tech Stack

- **Framework:** Next.js 16 (App Router) with React 19 and the React Compiler
- **Language:** TypeScript (strict)
- **Database:** Supabase (PostgreSQL, Auth, Queues/pgmq, Edge Functions)
- **Validation:** Zod schemas
- **Testing:** Vitest (unit) + Playwright (e2e)
- **UI:** shadcn/ui + Tailwind CSS 4, organized with Atomic Design

## Documentation

- [Architecture](docs/architecture.md)
- [Data model](docs/data-model.md)
- [Contributor and agent conventions](AGENTS.md)

## Getting Started

pnpm is the package manager (`pnpm-lock.yaml`; the Docker image installs with `--frozen-lockfile`).

```bash
pnpm install
cp .env.example .env.local
npx supabase@latest start        # local Postgres/Auth/Storage; prints the API URL and keys
# put the printed URL, anon key and service role key into .env.local
pnpm dev                          # http://localhost:3090
```

Use `npx supabase@latest ...` for Supabase CLI commands; no global install is assumed. The `supabase:*` and `db:types` scripts call a bare `supabase` binary, so run them through `pnpm exec` or use the `npx` form directly.

After adding or changing a migration in `supabase/migrations/`, apply it and regenerate the types. `src/types/database.ts` is generated, and a stale copy breaks `pnpm build`:

```bash
npx supabase@latest db reset
npx supabase@latest gen types typescript --local > src/types/database.ts
```

Redirect stdout only; progress text from Docker on stderr must not end up in the file.

## Scripts

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Next dev server on `0.0.0.0:3090` |
| `pnpm build` / `pnpm start` | Production build / server |
| `pnpm test:run` | Unit tests once (`pnpm test` watches) |
| `pnpm e2e` | Playwright tests |
| `pnpm lint` | ESLint |
| `pnpm catalog:import`, `pnpm catalog:embeddings:seed` | Seed the global catalog (see below) |
| `pnpm scrape:eval*` | Yupoo scraping evaluation scripts in `scripts/` |

## Catalog Import

`data/catalog-import.json` is the canonical seed payload for approved global catalog entries. Keep ad hoc research and agent scratch files out of git; only move curated brand, alias, and product type rows into this file.

Required environment:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Import order:

1. Edit `data/catalog-import.json`.
2. Import the catalog rows.
3. Rebuild embeddings from the approved rows.

```bash
pnpm catalog:import
pnpm catalog:embeddings:seed
```

This populates the shared catalog tables globally. Rebuild embeddings after import so classification and matching pick up the new approved entries.

You can also import a different file path:

```bash
pnpm catalog:import -- data/my-research.json
```

## Mission Queue Runtime

Mission buttons enqueue Supabase Queue messages instead of running long stages in the web request. Production needs:

- Supabase Queues / `pgmq`
- `pg_cron`
- `pg_net`
- Vault secrets named `project_url` and `service_role_key`
- Edge Function `mission-queue`
- `MISSION_WORKER_URL` and `MISSION_WORKER_TOKEN` secrets for the processor's stage worker callback

Apply migrations, deploy the Edge Function, then store the schedule secrets:

```sql
select vault.create_secret('https://project-ref.supabase.co', 'project_url');
select vault.create_secret('YOUR_SUPABASE_SERVICE_ROLE_KEY', 'service_role_key');
```

Deploy:

```bash
supabase functions deploy mission-queue
```

The migration creates the `mission_runs` queue, DB-backed mission run logs, compact stage events, retry metadata on `sourcing_missions`, and a one-minute scheduled catch-up invocation. Successful queue messages are deleted by the processor; failed messages remain available for retry after their visibility window.

### Local queue testing

Local queue testing uses the Next dev server as the stage worker and the local Supabase Edge Runtime as the queue consumer.

1. Start Supabase:

```bash
pnpm supabase:start
```

If you already had Supabase running before the queue wrapper migration was added, restart it and apply migrations:

```bash
pnpm supabase:stop
pnpm supabase:start
pnpm exec supabase db reset
```

2. Copy the local API URL, anon key, and service role key from `supabase status` into `.env.local`. Also set:

```bash
SUPABASE_MISSION_PROCESSOR_FUNCTION=mission-queue
MISSION_WORKER_URL=http://localhost:3090/api/mission-worker
MISSION_WORKER_TOKEN=<shared local secret>
MISSION_QUEUE_BATCH_SIZE=5
MISSION_DISCOVERY_MAX_REQUESTS=24
```

Mission Run buttons default to running the stage inline in the server action while `NODE_ENV=development` (`MISSION_RUN_INLINE`; explicit `true`/`false` overrides the default), so local runs need no worker or Edge Function. Set `MISSION_RUN_INLINE=false` to exercise the queue path locally.

3. Create `supabase/.env.local` from `supabase/.env.example`. Use the same `MISSION_WORKER_TOKEN`. The Edge Runtime worker URL should usually be:

```bash
MISSION_WORKER_URL=http://host.docker.internal:3090/api/mission-worker
MISSION_WORKER_TIMEOUT_MS=120000
```

On Linux, if `host.docker.internal` does not resolve from the Edge Runtime container, use:

```bash
MISSION_WORKER_URL=http://172.17.0.1:3090/api/mission-worker
```

When Next is running inside WSL and Supabase is running in Docker, use the WSL VM IP instead of `172.17.0.1`:

```bash
hostname -I | awk '{print $1}'
MISSION_WORKER_URL=http://<wsl-ip>:3090/api/mission-worker
```

4. Run the Next app:

```bash
pnpm dev
```

This binds Next to `0.0.0.0:3090` so the Supabase Edge Runtime container can call the local worker endpoint.

Or run Next in Docker:

```bash
pnpm dev:docker:build
pnpm dev:docker
```

The Docker dev service publishes Next on `localhost:3090`. It also sets `SUPABASE_SERVER_URL=http://host.docker.internal:54321` for server-side Supabase calls from inside the container, while browser code can keep `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`.

With Next in Docker and Supabase Edge Runtime also in Docker, set the Edge Function worker callback in `supabase/.env.local` to:

```bash
MISSION_WORKER_URL=http://host.docker.internal:3090/api/mission-worker
```

5. In a second terminal, run the local Edge Function:

```bash
pnpm supabase:functions:serve
```

6. Create or sign in as a local user, create a sourcing mission, and click `Run Discovery`.

7. Inspect `sourcing_missions`, `sourcing_mission_runs`, and `sourcing_mission_stage_events`. A successful run should leave the mission past `discovery_queued`, write run/event rows, and delete the successful queue message.


