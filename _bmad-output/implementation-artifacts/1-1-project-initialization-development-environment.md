# Story 1.1: Project Initialization & Development Environment

Status: review

## Story

As a developer,
I want to scaffold the Next.js + shadcn/ui + Supabase project with testing tools configured,
so that the team has a working foundation before any feature work begins.

## Acceptance Criteria

1. **Given** the project repo is initialized, **When** `npm run dev` is executed, **Then** the Next.js app loads at localhost:3000 without errors.

2. **Given** the development environment, **When** `supabase start` is executed, **Then** the local Supabase stack (Postgres, Auth, Storage) is running.

3. **Given** the project setup is complete, **When** inspected, **Then**:
   - Packages installed: `@supabase/supabase-js`, `@supabase/ssr`, `zod`, `react-hook-form`, `@hookform/resolvers`
   - Vitest configured with at least one placeholder test (`src/lib/utils/cn.test.ts`)
   - Playwright configured with at least one placeholder e2e spec (`e2e/auth.spec.ts`)
   - `.env.example` contains all required key names with empty values
   - `.env.local` is gitignored (never committed)
   - Path alias `@/*` resolves to `src/` (verified in `tsconfig.json`)
   - `db:types` npm script exists: `supabase gen types typescript --local > src/types/database.ts`

## Tasks / Subtasks

- [x] Task 1: Scaffold Next.js project (AC: #1, #3)
  - [x] Run `npx create-next-app@latest app --typescript --tailwind --eslint --app --src-dir --import-alias '@/*'`
  - [x] Verify `tsconfig.json` has `"@/*": ["./src/*"]` path alias
  - [x] Verify `tailwind.config.ts` was created (will be extended in Story 1.2)

- [x] Task 2: Initialize shadcn/ui (AC: #1)
  - [x] Run `npx shadcn@latest init` (choose defaults: New York style, neutral color, CSS variables on)
  - [x] Verify `components.json` created at project root
  - [x] Verify `src/lib/utils.ts` created with `cn()` helper

- [x] Task 3: Install all required packages (AC: #3)
  - [x] Run `npm install @supabase/supabase-js @supabase/ssr zod react-hook-form @hookform/resolvers`
  - [x] Verify all packages appear in `package.json` dependencies

- [x] Task 4: Initialize Supabase project (AC: #2)
  - [x] Run `supabase init` in project root (creates `supabase/config.toml` and `supabase/migrations/`)
  - [x] Verify `supabase/` directory is created with `config.toml`
  - [x] Run `supabase start` and confirm local stack is running (Postgres + Auth + Storage)
  - [x] Note the local `SUPABASE_URL` and `SUPABASE_ANON_KEY` from output

- [x] Task 5: Configure environment files (AC: #3)
  - [x] Create `.env.example` with key names (no values):
    ```
    NEXT_PUBLIC_SUPABASE_URL=
    NEXT_PUBLIC_SUPABASE_ANON_KEY=
    SUPABASE_SERVICE_ROLE_KEY=
    ```
  - [x] Create `.env.local` with local Supabase values (from `supabase start` output)
  - [x] Verify `.env.local` is listed in `.gitignore`

- [x] Task 6: Create Supabase client modules (AC: #1)
  - [x] Create `src/lib/supabase/server.ts` — server-side client using `createServerClient` from `@supabase/ssr`
  - [x] Create `src/lib/supabase/client.ts` — browser client using `createBrowserClient` from `@supabase/ssr`
  - [x] **NEVER** instantiate Supabase inline anywhere in the codebase — always import from these two files

- [x] Task 7: Add `db:types` npm script (AC: #3)
  - [x] Add to `package.json` scripts: `"db:types": "supabase gen types typescript --local > src/types/database.ts"`
  - [x] Create `src/types/` directory (placeholder `database.ts` can be empty with a comment)
  - [x] Verify `npm run db:types` runs without error (types will be empty until migrations are written in Story 1.3)

- [x] Task 8: Configure Vitest (AC: #3)
  - [x] Install: `npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom`
  - [x] Create `vitest.config.ts` at project root
  - [x] Create `src/test/setup.ts` with `import '@testing-library/jest-dom/vitest'`
  - [x] Create placeholder test `src/lib/utils/cn.test.ts`
  - [x] Add to `package.json` scripts: `"test": "vitest"`, `"test:run": "vitest run"`
  - [x] Verify `npm run test:run` passes

- [x] Task 9: Configure Playwright (AC: #3)
  - [x] Install: `npm install -D @playwright/test`
  - [x] Run `npx playwright install chromium` (install only Chromium browser)
  - [x] Create `playwright.config.ts` at project root with `baseURL: 'http://localhost:3000'`
  - [x] Create `e2e/` directory at project root
  - [x] Create placeholder `e2e/auth.spec.ts`
  - [x] Add to `package.json` scripts: `"e2e": "playwright test"`

- [x] Task 10: Verify full dev stack (AC: #1, #2)
  - [x] `npm run dev` starts without errors at localhost:3000
  - [x] `npm run test:run` passes (Vitest placeholder)
  - [x] `npx supabase start` shows all services running

## Dev Notes

### Critical Architecture Constraints

- **No deviation from starter path:** `create-next-app` → `shadcn@latest init` → manual package installs. No T3 stack, no other boilerplate.
- **Supabase client instantiation rule (MANDATORY):** All code MUST import from `src/lib/supabase/server.ts` or `src/lib/supabase/client.ts`. Never instantiate `createServerClient` or `createBrowserClient` inline anywhere.
- **No arbitrary Tailwind values:** `tailwind.config.ts` is created by `create-next-app` — do NOT add design tokens yet. Tailwind token system is Story 1.2's responsibility. Only verify the file exists.
- **`.env.local` is never committed:** Must be in `.gitignore`. The `create-next-app` starter includes this by default — verify it's there.
- **Path alias:** `@/*` must resolve to `src/`. Verify in both `tsconfig.json` (`compilerOptions.paths`) and `next.config.ts` (if webpack alias needed).

### Exact Initialization Commands (in order)

```bash
# 1. Scaffold (run from PARENT directory of where you want the project)
npx create-next-app@latest app \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*"

cd app

# 2. shadcn/ui
npx shadcn@latest init
# Prompts: New York style, Neutral color base, YES to CSS variables

# 3. Core runtime packages
npm install @supabase/supabase-js @supabase/ssr zod react-hook-form @hookform/resolvers

# 4. Supabase CLI project init
supabase init

# 5. Start local stack (Docker must be running)
supabase start
# Copy SUPABASE_URL and SUPABASE_ANON_KEY from output → .env.local

# 6. Testing tools
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
npm install -D @playwright/test
npx playwright install chromium
```

### Required File Structure Created by This Story

```
proto-yupoo-organizer/              # repo root (Next.js lives here, not in app/ subfolder)
├── .env.example                    # Key names, empty values
├── .env.local                      # Local Supabase values (gitignored)
├── .gitignore                      # Must include .env.local
├── components.json                 # shadcn/ui config
├── next.config.ts
├── package.json                    # All scripts: dev, build, test, test:run, e2e, db:types
├── playwright.config.ts
├── tailwind.config.ts              # EXISTS but tokens NOT added yet (Story 1.2)
├── tsconfig.json                   # @/* alias to ./src/*
├── vitest.config.ts
├── supabase/
│   ├── config.toml
│   └── migrations/                 # Empty — migrations added in Story 1.3
├── e2e/
│   └── auth.spec.ts               # Placeholder test
└── src/
    ├── app/
    │   ├── globals.css
    │   ├── layout.tsx
    │   └── page.tsx
    ├── components/
    │   └── ui/                    # shadcn/ui components added via CLI
    ├── lib/
    │   ├── supabase/
    │   │   ├── server.ts          # createServerClient (SSR)
    │   │   └── client.ts          # createBrowserClient (browser)
    │   └── utils.ts               # cn() — created by shadcn init
    ├── test/
    │   └── setup.ts               # @testing-library/jest-dom import
    └── types/
        └── database.ts            # Placeholder — populated by db:types script
```

### Supabase Client Implementation

**`src/lib/supabase/server.ts`** (Server Components + Server Actions):

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

export function createClient() {
  const cookieStore = cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {}
        },
      },
    },
  );
}
```

**`src/lib/supabase/client.ts`** (Client Components only):

```ts
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

### `.env.example` Content

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

### What This Story Does NOT Include

- No Tailwind design tokens (Story 1.2)
- No Supabase migrations (Story 1.3)
- No middleware (Story 1.3)
- No authentication pages (Story 1.3)
- No shadcn/ui components beyond what `shadcn init` provides
- No `src/actions/`, `src/components/atoms/`, or any feature code

### Project Structure Notes

- `src/components/ui/` is where `shadcn@latest add <component>` installs components (controlled by `components.json`)
- `src/components/atoms/`, `molecules/`, `organisms/`, `templates/` directories are NOT created in this story — they belong to Story 1.2+
- `src/actions/` directory is NOT created in this story

### References

- Architecture: `_bmad-output/planning-artifacts/architecture.md` — Starter Template Evaluation section
- Architecture: `_bmad-output/planning-artifacts/architecture.md` — Implementation Patterns section (Supabase client instantiation rule)
- Architecture: `_bmad-output/planning-artifacts/architecture.md` — Complete Project Directory Structure
- Epics: `_bmad-output/planning-artifacts/epics.md` — Story 1.1 acceptance criteria
- Epics: `_bmad-output/planning-artifacts/epics.md` — Additional Requirements section

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Tailwind v4 deviation: `create-next-app` installed Tailwind CSS v4 (`@tailwindcss/postcss`) instead of v3. No `tailwind.config.ts` is created by default in v4. Created a placeholder `tailwind.config.ts` for Story 1.2 to extend. Primary token config lives in `src/app/globals.css` via `@theme`.
- `@testing-library/jest-dom` v6 requires importing from `@testing-library/jest-dom/vitest` in Vitest setup files (not the root export). Fixed in `src/test/setup.ts`.
- `cookies()` from `next/headers` in Next.js 16 returns a `Promise`. `createClient()` in `server.ts` is now `async` and `await`s `cookies()`.
- Supabase CLI v2.83.0 uses new Publishable/Secret key format instead of JWT anon/service_role keys. `.env.local` uses the new key format.
- Supabase CLI is in the root `package.json` devDependencies (merged during repo restructure). Run `npx supabase <cmd>` from project root.
- Vitest picks up `e2e/` Playwright files by default. Fixed by adding `include: ["src/**/*.{test,spec}.{ts,tsx}"]` to `vitest.config.ts`.

### Completion Notes List

- All 10 tasks completed. Next.js 16.2.1 app scaffolded at repo root with TypeScript, Tailwind CSS v4, ESLint, App Router, src-dir layout, and `@/*` import alias. (Originally in `app/` subfolder; moved to root in post-story restructure.)
- shadcn/ui v4.1.0 initialized with Tailwind v4 support. `components.json` and `src/lib/utils.ts` (with `cn()`) created.
- Required packages installed: `@supabase/supabase-js`, `@supabase/ssr`, `zod`, `react-hook-form`, `@hookform/resolvers`.
- Supabase local stack running at `http://127.0.0.1:54321` with Postgres, Auth, and Storage.
- Supabase client modules created at `src/lib/supabase/server.ts` (async, awaits cookies) and `src/lib/supabase/client.ts`.
- Vitest configured with jsdom + @testing-library. `npm run test:run` passes 1 test (cn utility).
- Playwright configured with Chromium. `e2e/auth.spec.ts` placeholder created.
- `npm run build` compiles successfully with no TypeScript errors.
- `npm run db:types` connects to local Supabase and generates types successfully.

### File List

.env.example
.env.local
components.json
e2e/auth.spec.ts
next.config.ts
package.json
playwright.config.ts
postcss.config.mjs
src/app/globals.css
src/app/layout.tsx
src/app/page.tsx
src/components/ui/button.tsx
src/lib/supabase/client.ts
src/lib/supabase/server.ts
src/lib/utils.ts
src/lib/utils/cn.test.ts
src/test/setup.ts
src/types/database.ts
tailwind.config.ts
tsconfig.json
vitest.config.ts
supabase/config.toml
supabase/migrations/

## Change Log

- 2026-03-20: Story 1.1 implemented — Next.js project scaffolded with full dev toolchain (Vitest, Playwright, Supabase local stack, shadcn/ui). Notable deviations from spec: Tailwind v4 (CSS-based config), Next.js 16 async cookies(), Supabase CLI v2 publishable/secret keys.
