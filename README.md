This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3090](http://localhost:3090) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

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

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
