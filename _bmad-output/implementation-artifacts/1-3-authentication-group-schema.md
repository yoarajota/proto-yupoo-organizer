# Story 1.3: Authentication & Group Schema

Status: review

## Story

As a user,
I want to register with email and password and log in to the app,
so that I can access the group's shared data securely.

## Acceptance Criteria

1. **Given** I am not authenticated, **When** I navigate to any `(app)` route, **Then** `src/middleware.ts` redirects me to `/login`.

2. **Given** the login page, **When** I submit valid credentials, **Then** I am authenticated via Supabase Auth and redirected to `/active-inquiries`.

3. **Given** the login page, **When** I submit invalid credentials, **Then** an inline error is shown; no redirect occurs.

4. **Given** the database migrations run, **When** I inspect the schema, **Then** `groups` and `group_members` tables exist with all required columns; `created_at` + `updated_at` on both; `supabase gen types typescript --local > src/types/database.ts` runs as the `db:types` npm script.

5. **Given** a removed member's session token, **When** they attempt to access any app route, **Then** they are denied and redirected to `/login` immediately (NFR8).

## Tasks / Subtasks

- [x] Task 1: Install required shadcn/ui components
  - [x] Run `npx shadcn@latest add form` — React Hook Form wrapper
  - [x] Run `npx shadcn@latest add input` — Input atom
  - [x] Run `npx shadcn@latest add label` — Label atom
  - [x] Run `npx shadcn@latest add card` — Card container for login UI
  - [x] Verify `react-hook-form`, `@hookform/resolvers`, `zod` are installed (should be from Story 1.1)
  - [x] **CRITICAL:** After installing, inspect the generated `src/components/ui/form.tsx`. If it imports from `@base-ui/react` (as found in Story 1.2 tooltip), note and adapt — the API may differ from standard shadcn/Radix docs. Check for `render` prop instead of `asChild`.

- [x] Task 2: Create groups migration
  - [x] Create `supabase/migrations/001_groups.sql` (see Dev Notes for exact schema)
  - [x] Run `supabase db reset` to apply migrations to local instance
  - [x] Run `npm run db:types` to regenerate `src/types/database.ts`
  - [x] Verify the generated `src/types/database.ts` contains `groups` and `group_members` table types

- [x] Task 3: Create Zod schemas
  - [x] Create `src/lib/schemas/group.ts` — `LoginSchema` with `{ email: z.string().email(), password: z.string().min(8) }`
  - [x] No other schemas in this story — keep scope narrow

- [x] Task 4: Create `groups` Server Actions
  - [x] Create `src/actions/groups.ts` with named exports: `signIn`, `signOut`
  - [x] `signIn(formData)`: calls `supabase.auth.signInWithPassword()`; returns `{ data, error }` — NEVER throw
  - [x] `signOut()`: calls `supabase.auth.signOut()`; returns `{ data: null, error: null }` on success
  - [x] Import Supabase client from `src/lib/supabase/server.ts` only — never inline instantiation
  - [x] See Dev Notes for exact return shape requirement

- [x] Task 5: Implement `src/middleware.ts`
  - [x] Read `node_modules/next/dist/docs/` for Next.js 16 middleware changes before writing
  - [x] Implement session refresh + route protection (see Dev Notes for pattern)
  - [x] `(app)` routes → require valid session; redirect to `/login` if missing
  - [x] `(auth)` routes → always accessible (public)
  - [x] Export `config.matcher` to exclude Next.js internals and static assets
  - [x] For NFR8: middleware calls `supabase.auth.getUser()` — Supabase Auth handles session validity; `signOut` in Story 1.4 removal flow invalidates session. Basic middleware check of session validity is sufficient here.

- [x] Task 6: Implement login page
  - [x] Replace `src/app/(auth)/login/page.tsx` stub with real form
  - [x] `"use client"` — uses React Hook Form + `useTransition` for pending state
  - [x] Use `useForm` with `zodResolver(LoginSchema)` and `mode: 'onBlur'`
  - [x] Form fields: email (Input), password (Input type="password"), submit Button
  - [x] On submit: call `signIn` Server Action via `startTransition`; on error show inline `FormMessage`; on success use `router.push('/active-inquiries')` from `next/navigation`
  - [x] Wrap in `Card` component with centered layout (no AppShell — this is an `(auth)` route)
  - [x] Use only named Tailwind tokens — no arbitrary bracket values (Tailwind v4, tokens in `globals.css`)
  - [x] All atoms follow Atomic Design: form fields are atoms, the form itself is an organism

- [x] Task 7: Write tests
  - [x] Create `src/actions/groups.test.ts` — mock Supabase client; test `signIn` returns `{ data: session, error: null }` on success; test returns `{ data: null, error: { message: string } }` on auth error
  - [x] Create `src/app/(auth)/login/LoginForm.test.tsx` (extract form to separate component for testability) — test: email validation shows error on blur; password validation shows error on blur; submit button disabled while pending
  - [x] Run `npm run test:run` and confirm all tests pass
  - [x] Run `npm run build` and confirm no TypeScript errors

## Dev Notes

### What Already Exists (DO NOT Recreate)

- `src/lib/supabase/server.ts` — `createClient()` is `async`, `await cookies()` — **already correct for Next.js 16**
- `src/lib/supabase/client.ts` — `createBrowserClient()` — already correct
- `src/app/(auth)/login/page.tsx` — stub `<div>Login page (Story 1.3)</div>` — **replace entirely**
- `src/app/(auth)/layout.tsx` — minimal public layout — do NOT modify
- `src/app/(app)/layout.tsx` — AppShell wrapper — do NOT modify
- `src/types/database.ts` — already generated but empty (only placeholder types) — will be regenerated in Task 2
- `src/test/setup.ts` — has `afterEach(cleanup)` — do NOT change

### CRITICAL Runtime Deviations (Discovered in Stories 1.1 & 1.2)

**1. Next.js 16 async cookies** (Story 1.1):
```ts
// ✅ CORRECT — already in server.ts
export async function createClient() {
  const cookieStore = await cookies(); // MUST await
  return createServerClient<Database>(...)
}
```
**Middleware is different** — in middleware context, cookies are handled synchronously via `request.cookies`. Do NOT use `next/headers` cookies in middleware. See middleware pattern below.

**2. Supabase CLI v2 key format** (Story 1.1):
`.env.local` uses Publishable/Secret keys from `supabase start` output, NOT legacy JWT anon/service_role. Key names remain `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

**3. Tailwind v4 — all tokens in `globals.css`** (Story 1.2):
- `tailwind.config.ts` is a PLACEHOLDER — never add tokens there
- All design values reference named tokens from `@theme` in `globals.css`
- Available tokens: `text-label-xs`, `w-sidebar`, `bg-surface-container-low`, etc.
- Zero arbitrary bracket values like `text-[14px]` or `w-[240px]`

**4. shadcn uses @base-ui/react, not @radix-ui** (Story 1.2):
The installed shadcn components in this project use `@base-ui/react` — the `asChild` pattern from standard shadcn/Radix docs does NOT apply. Use `render` prop instead. Check each new component you install — `form.tsx` may use this API.

**5. Next.js version:** 16.2.1 — read `node_modules/next/dist/docs/` before using any unfamiliar APIs, especially for middleware.

### Groups Migration — 001_groups.sql

```sql
-- 001_groups.sql
create table groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(group_id, user_id)
);

-- RLS: enable on both tables (policies defined in 007_rls_policies.sql)
alter table groups enable row level security;
alter table group_members enable row level security;

-- Temporary permissive policy for development (Story 1.3 only — replaced in Story 1.4)
-- Without any policy, all queries return empty results even for authenticated users.
create policy "Authenticated users can read groups"
  on groups for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can read group_members"
  on group_members for select
  using (auth.role() = 'authenticated');

-- updated_at trigger function
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger groups_updated_at
  before update on groups
  for each row execute function update_updated_at();

create trigger group_members_updated_at
  before update on group_members
  for each row execute function update_updated_at();
```

**IMPORTANT:** The full comprehensive RLS policy set (007_rls_policies.sql) is deferred to later stories when all tables exist. This migration adds minimal permissive policies for dev-only so queries work. Story 1.4 will add group-scoped policies.

### Middleware Pattern — src/middleware.ts

Supabase SSR middleware pattern for Next.js (check docs for Next.js 16 specifics):

```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // CRITICAL: use getUser(), NOT getSession() — getSession() is not reliable server-side
  const { data: { user } } = await supabase.auth.getUser()

  const isAuthRoute = request.nextUrl.pathname.startsWith('/login')

  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

**CRITICAL:** Read `node_modules/next/dist/docs/` for any Next.js 16 changes to middleware API before writing. The above is the standard Supabase pattern — verify it still applies in 16.2.1.

### Server Action Return Shape

```ts
// src/actions/groups.ts — MUST follow this contract exactly
"use server"

export async function signIn(formData: { email: string; password: string }) {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword(formData)
  if (error) return { data: null, error: { message: error.message } }
  return { data: data.session, error: null }
}

export async function signOut() {
  const supabase = await createClient()
  const { error } = await supabase.auth.signOut()
  if (error) return { data: null, error: { message: error.message } }
  return { data: null, error: null }
}
```

### Login Page Pattern

The login page is in `(auth)` route group — it uses the minimal `(auth)/layout.tsx` (no AppShell). Structure:

```
src/app/(auth)/login/
  page.tsx          — "use client", renders LoginForm
  LoginForm.tsx     — extracted form component (makes it testable)
  LoginForm.test.tsx — co-located tests
```

**Extract `LoginForm.tsx` as a separate Client Component** so it can be tested in isolation without needing to render the full page. The page just renders `<LoginForm />`.

Login form UI: centered card layout, full viewport height (`min-h-svh`), use `bg-background` (zinc-50 token). The card uses `bg-card` shadow. Only valid token classes.

### Atomic Design Placement

- `LoginForm.tsx` → `src/components/organisms/LoginForm.tsx` (or co-located with page — either is acceptable, co-location is simpler)
- `form.tsx`, `input.tsx`, `label.tsx`, `card.tsx` → `src/components/ui/` (shadcn generated — do not move)
- NO new atoms need to be created in `src/components/atoms/` for this story

### AGENTS.md Warning

The `AGENTS.md` says: *"This is NOT the Next.js you know. This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code."*

**Verify before using:**
- `NextRequest` / `NextResponse` API in middleware
- The `matcher` config format for Next.js 16
- Server Action file conventions (`"use server"` placement)

### NFR8 — Removed Member Revocation

Story 1.3 scope: middleware checks for a valid session JWT via `getUser()`. If session is invalid or expired, user is redirected to `/login`. **Immediate revocation** (NFR8) is fully handled in Story 1.4 — when an admin removes a member, the removal action calls Supabase Auth admin API to sign out the user, which invalidates their JWT. Story 1.3 middleware is the gatekeeper that enforces the revocation on the next request.

### What This Story Does NOT Include

- No group creation logic (Story 1.4 — admin creates group on first login)
- No invitation or member removal (Story 1.4)
- No registration page — Supabase handles registration via invite (FR2); login-only flow for MVP
- No settings page (Story 1.4)
- No RLS policies beyond basic permissive dev policies (007_rls_policies.sql is a later story)
- No `supabase/migrations/002_suppliers.sql` or other domain migrations
- No new atom components beyond what shadcn generates
- No TopBar user avatar (Story 1.4)

### File List for This Story

```
src/
├── middleware.ts                              # NEW
├── app/(auth)/login/
│   └── page.tsx                              # REPLACE stub
├── components/organisms/
│   └── LoginForm.tsx                         # NEW (or co-located with page)
│   └── LoginForm.test.tsx                    # NEW
├── actions/
│   ├── groups.ts                             # NEW
│   └── groups.test.ts                        # NEW
├── lib/schemas/
│   └── group.ts                              # NEW
└── components/ui/
    ├── form.tsx                              # NEW (shadcn add form)
    ├── input.tsx                             # NEW (shadcn add input)
    ├── label.tsx                             # NEW (shadcn add label)
    └── card.tsx                              # NEW (shadcn add card)

supabase/migrations/
└── 001_groups.sql                            # NEW
```

### References

- Architecture: `_bmad-output/planning-artifacts/architecture.md` — Runtime Deviations, Server Action return shape, Middleware boundary, Auth flow
- Epics: `_bmad-output/planning-artifacts/epics.md` — Story 1.3 acceptance criteria, FR1–FR6, NFR5–NFR8
- Story 1.1: `_bmad-output/implementation-artifacts/1-1-project-initialization-development-environment.md` — Next.js 16 async cookies, Supabase CLI v2 keys
- Story 1.2: `_bmad-output/implementation-artifacts/1-2-design-system-tokens-appshell.md` — shadcn @base-ui/react deviation, Tailwind v4 token approach, afterEach cleanup pattern, debug log

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Next.js 16 breaking change: `middleware.ts` → `proxy.ts`, function `middleware` → `proxy`. Implemented as `src/proxy.ts` per `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md`.
- `base-nova` shadcn style has no registry entries for `form`, `input`, `label`, `card` components — all four written manually following `button.tsx`/`tooltip.tsx` patterns in the codebase.
- `@radix-ui/react-slot` not installed; `FormControl` implemented via `React.cloneElement` to inject ARIA props into child input.
- `@testing-library/user-event` not installed; tests use `fireEvent` from `@testing-library/react`.
- `@hookform/resolvers` v5.2.2 supports Zod v4 (auto-detected at runtime).

### Completion Notes List

- All 7 tasks and all subtasks completed.
- `src/proxy.ts` created (Next.js 16 name); implements Supabase SSR session refresh + route protection via `getUser()`.
- `supabase/migrations/001_groups.sql` applied via `supabase db reset`; types regenerated.
- `src/lib/schemas/group.ts` exports `LoginSchema` (email + min-8 password).
- `src/actions/groups.ts` exports `signIn`/`signOut` with exact return shape contract.
- `src/app/(auth)/login/LoginForm.tsx` organism component + `page.tsx` stub replacement.
- `src/components/ui/{form,input,label,card}.tsx` manually created for base-nova style.
- 23 tests pass, build clean (no TypeScript errors).

### File List

- `supabase/migrations/001_groups.sql` — NEW
- `src/types/database.ts` — MODIFIED (regenerated with groups/group_members types)
- `src/proxy.ts` — NEW (Next.js 16 proxy/middleware)
- `src/lib/schemas/group.ts` — NEW
- `src/actions/groups.ts` — NEW
- `src/actions/groups.test.ts` — NEW
- `src/app/(auth)/login/page.tsx` — MODIFIED (stub replaced)
- `src/app/(auth)/login/LoginForm.tsx` — NEW
- `src/app/(auth)/login/LoginForm.test.tsx` — NEW
- `src/components/ui/form.tsx` — NEW
- `src/components/ui/input.tsx` — NEW
- `src/components/ui/label.tsx` — NEW
- `src/components/ui/card.tsx` — NEW

## Change Log

- 2026-03-21: Story 1.3 created — authentication, middleware, groups schema
- 2026-03-21: Story 1.3 implemented — all tasks complete, 23 tests pass, build clean
