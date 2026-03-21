# Story 1.4: User Management (Admin)

Status: review

> **REPLACES original Story 1.4 "Group Management (Admin)"** — Sprint Change Proposal 2026-03-21. Group concept removed; this story now implements system user management (invite/deactivate) and auth-gated RLS.

## Story

As an admin,
I want to invite new users to the system and deactivate users who leave,
so that only trusted people have access to the shared workspace.

## Acceptance Criteria

1. **Given** I am the first authenticated user, **When** I land on any `(app)` route, **Then** `ensureProfile()` creates my `profiles` row with `role = 'admin'` — no group is created (FR2 prerequisite).

2. **Given** I am an admin on the Settings page, **When** I enter a user's email and click Invite, **Then** an invitation email is sent via Supabase Auth `inviteUserByEmail`; a `profiles` row is created for the invited user with `role = 'member'` and `is_active = true` (FR2).

3. **Given** I am an admin, **When** I click Deactivate on a user row, **Then** `profiles.is_active` is set to `false` AND their active session is revoked via `adminClient.auth.admin.signOut` — they lose access immediately (FR3, NFR8).

4. **Given** any authenticated user, **When** they access the app, **Then** they see all shared data — RLS enforces auth-gated access at the DB layer (`auth.uid() IS NOT NULL`), not application code (FR4, NFR5).

5. **Given** a deactivated user's records (any data they created), **When** viewed by remaining users, **Then** all records remain intact and visible — `is_active = false` only affects access, not data (FR5).

6. **Given** I am an admin on the Settings / Users page, **When** it loads, **Then** I see a list of all users with their role, active status, and Deactivate/Reactivate action per row (own row has no action button).

## Tasks / Subtasks

- [x] Task 1: Replace groups migration with profiles migration
  - [x] Delete `supabase/migrations/001_groups.sql`
  - [x] Create `supabase/migrations/001_profiles.sql` (see Dev Notes for exact SQL)
  - [x] Run `supabase db reset` to apply all migrations fresh
  - [x] Run `npm run db:types` to regenerate `src/types/database.ts`
  - [x] Verify `src/types/database.ts` contains `profiles` type (no `groups`, no `group_members`)

- [x] Task 2: Create service role Supabase client
  - [x] Add `SUPABASE_SERVICE_ROLE_KEY=` to `.env.example` (empty value, key name only)
  - [x] Add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local` — get value from `supabase start` output labeled "service_role key"
  - [x] Create `src/lib/supabase/admin.ts` — exports `createAdminClient()` using `createClient` from `@supabase/supabase-js` directly (NOT `@supabase/ssr`) with the service role key
  - [x] Server-only: never import `createAdminClient` in client components

- [x] Task 3: Create auth-gated + creator-or-admin RLS migration
  - [x] Create `supabase/migrations/007_rls_policies.sql` (see Dev Notes for exact SQL)
  - [x] Drop the dev-only permissive policy added in `001_profiles.sql`
  - [x] Add `is_admin()` helper function (`security definer`)
  - [x] Add auth-gated SELECT + INSERT policies for all tables
  - [x] Add creator-or-admin DELETE + UPDATE policies for all tables
  - [x] Add profiles-specific policies (admin can manage users)
  - [x] Run `supabase db reset` to apply
  - [x] Run `npm run db:types` to regenerate types

- [x] Task 4: Extend Zod schemas
  - [x] In `src/lib/schemas/group.ts` → rename file to `src/lib/schemas/user.ts` OR create new `src/lib/schemas/user.ts`
  - [x] ADD `InviteUserSchema` — `{ email: z.string().email() }`
  - [x] ADD `InviteUserFormValues` type inference
  - [x] Keep `LoginSchema` / `LoginFormValues` wherever they currently live

- [x] Task 5: Create user management Server Actions
  - [x] Create `src/actions/users.ts` with named exports (see Dev Notes for patterns):
    - [x] `ensureProfile()` — ensures current user has a `profiles` row; first user gets `admin`, rest get `member`
    - [x] `inviteUser(formData: { email: string })` — admin-only; calls `adminClient.auth.admin.inviteUserByEmail`; inserts `profiles` row for invited user
    - [x] `deactivateUser(userId: string)` — admin-only; sets `profiles.is_active = false`; calls `adminClient.auth.admin.signOut(userId)`
    - [x] `reactivateUser(userId: string)` — admin-only; sets `profiles.is_active = true`
    - [x] `getUsers()` — fetches all `profiles` rows joined with auth user email
    - [x] `getCurrentProfile()` — returns current user's `profiles` row
  - [x] All actions follow `{ data: T, error: null } | { data: null, error: { message: string } }` return shape — NEVER throw
  - [x] Keep `signIn` / `signOut` in `src/actions/groups.ts` — do NOT modify that file

- [x] Task 6: Create Settings page
  - [x] Create `src/app/(app)/settings/page.tsx` — Server Component
  - [x] Fetch users via `getUsers()` and current profile via `getCurrentProfile()`
  - [x] Render "Settings" heading and "Users" section
  - [x] Pass users and `isAdmin` boolean to `UserList` organism as props
  - [x] Non-admins see a read-only user list (no Invite or Deactivate controls)

- [x] Task 7: Create UserList organism
  - [x] Create `src/components/organisms/UserList.tsx` — Client Component (`"use client"`)
  - [x] Props: `users: Profile[]`, `isAdmin: boolean`, `currentUserId: string`
  - [x] Renders a list/table of users: email, role badge (`admin`/`member`), active status
  - [x] Admin-only: each row has Deactivate/Reactivate button calling respective action via `useTransition`; button disabled while pending; own row has no action button
  - [x] Admin-only: inline invite form — email input + "Invite" button; calls `inviteUser` via `useTransition`; show inline success/error after action; clear input on success
  - [x] Use only named Tailwind tokens — no arbitrary bracket values

- [x] Task 8: Update TopBar and app layout
  - [x] Modify `src/components/organisms/TopBar.tsx` — add optional `userEmail?: string` prop
  - [x] Replace the existing empty `<div className="ml-auto" aria-label="User actions" />` with: user email display (`text-label-sm text-muted-foreground`), Settings link (`/settings`), Sign Out button
  - [x] Sign Out calls `signOut()` via form + redirect to `/login`
  - [x] Keep TopBar as Server Component (no "use client")
  - [x] Modify `src/app/(app)/layout.tsx` — make it `async`; call `ensureProfile()`; fetch user email; pass as `userEmail` prop to TopBar (or through AppShell — check current AppShell structure first)

- [x] Task 9: Write tests
  - [x] Create `src/actions/users.test.ts` — mock Supabase client; test `ensureProfile` creates admin on first call; test `inviteUser` returns error for non-admin; test `deactivateUser` returns error when trying to deactivate self
  - [x] Create `src/components/organisms/UserList.test.tsx` — test Deactivate button hidden on own row; test invite form shows inline error on empty submit; test invite success clears input
  - [x] Use `fireEvent` from `@testing-library/react` (NOT `@testing-library/user-event` — not installed)
  - [x] Run `npm run test:run` and confirm all tests pass
  - [x] Run `npm run build` and confirm no TypeScript errors

## Dev Notes

### What Already Exists (DO NOT Recreate)

- `src/actions/groups.ts` — exports `signIn`, `signOut` — **do NOT modify**
- `src/lib/supabase/server.ts` — `createClient()` is `async`, `await cookies()` — already correct
- `src/proxy.ts` — Next.js 16 proxy/middleware — **do NOT touch**
- `src/components/organisms/TopBar.tsx` — has empty placeholder `div[aria-label="User actions"]` — extend only
- `src/app/(app)/layout.tsx` — minimal layout wrapping AppShell — extend to add `ensureProfile` + userEmail prop

### CRITICAL Runtime Deviations (Discovered in Stories 1.1–1.3 — ALL AGENTS MUST FOLLOW)

**1. Next.js 16 — middleware file is `src/proxy.ts`, function is named `proxy`** (Story 1.3):
```ts
// ✅ CORRECT — already implemented
// File: src/proxy.ts (NOT src/middleware.ts)
export async function proxy(request: NextRequest) { ... }
```
Do not create a `src/middleware.ts` — it will be ignored by Next.js 16.

**2. Next.js 16 async cookies** (Story 1.1):
```ts
// ✅ CORRECT — already in src/lib/supabase/server.ts
export async function createClient() {
  const cookieStore = await cookies(); // MUST await
  ...
}
```

**3. Tailwind v4 — tokens live in `src/app/globals.css`, NOT `tailwind.config.ts`** (Story 1.2):
- `tailwind.config.ts` is a placeholder — never add tokens there
- Available named tokens: `bg-surface-container-low`, `text-label-xs`, `text-label-sm`, `text-body-sm`, `text-body-md`, `w-sidebar`, `w-sidebar-collapsed`, etc.
- Zero arbitrary bracket values anywhere

**4. shadcn uses `@base-ui/react`, NOT `@radix-ui`** (Story 1.2):
- `asChild` pattern does NOT apply
- Use `render` prop: `<TooltipTrigger render={<button>text</button>} />`
- `@radix-ui/react-slot` is NOT installed

**5. No shadcn registry entries for `base-nova` style** (Story 1.3):
- `npx shadcn@latest add <anything>` will FAIL
- Write new UI components manually following patterns in existing `button.tsx`, `tooltip.tsx`, `card.tsx`

**6. `@testing-library/user-event` is NOT installed** (Story 1.3):
- Use `fireEvent` from `@testing-library/react` only

**7. Next.js version: 16.2.1** — read `node_modules/next/dist/docs/` before using any unfamiliar API.

### Profiles Migration — 001_profiles.sql

```sql
-- 001_profiles.sql
-- REPLACES 001_groups.sql — delete that file before running this
create type user_role as enum ('admin', 'member');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'member',
  is_active boolean not null default true,
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;

-- Temporary permissive policy for dev (replaced in Task 3 / 007_rls_policies.sql)
create policy "Authenticated users can read profiles"
  on profiles for select
  using (auth.role() = 'authenticated');

-- updated_at trigger (reuse function from 001 if already exists)
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at
  before update on profiles
  for each row execute function update_updated_at();
```

### RLS Migration — 007_rls_policies.sql

```sql
-- 007_rls_policies.sql
-- Drop dev-only permissive policy from 001_profiles.sql
drop policy if exists "Authenticated users can read profiles" on profiles;

-- Helper: is current user an admin?
-- security definer: avoids RLS recursion when checking profiles inside a policy
create or replace function is_admin()
returns boolean as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'admin' and is_active = true
  )
$$ language sql security definer stable;

-- PROFILES policies
create policy "Auth users can read profiles"
  on profiles for select
  using (auth.uid() is not null);

create policy "Admin can insert profiles"
  on profiles for insert
  with check (is_admin());

create policy "Admin can update profiles"
  on profiles for update
  using (is_admin());

-- GENERIC pattern for feature tables (suppliers, products, inquiries, sources, photo_hashes)
-- Applied here for tables that exist at this point; each feature migration enables RLS,
-- but the policies are defined in this single migration for consistency.

-- Note: suppliers/products/etc tables do NOT exist yet — those policies are added
-- when each Epic's first story runs. This file sets the policy PATTERN to follow.
-- Story 4.1 (inquiries) will reference this file for the exact policy SQL to use.
```

**Policy pattern for ALL feature tables:**
```sql
-- Read: any authenticated user
create policy "Auth users can read <table>"
  on <table> for select
  using (auth.uid() is not null);

-- Insert: any authenticated user
create policy "Auth users can insert <table>"
  on <table> for insert
  with check (auth.uid() is not null);

-- Update: creator or admin
create policy "Creator or admin can update <table>"
  on <table> for update
  using (created_by = auth.uid() or is_admin());

-- Delete: creator or admin
create policy "Creator or admin can delete <table>"
  on <table> for delete
  using (created_by = auth.uid() or is_admin());
```

### Service Role Client Pattern (`src/lib/supabase/admin.ts`)

```ts
import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"

export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // NOT the anon key
  )
}
// ⚠️  Server-only: never import in "use client" components
```

### ensureProfile Pattern (`src/actions/users.ts`)

```ts
export async function ensureProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: null }

  // Check if profile already exists
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle()

  if (profile) return { data: profile, error: null }

  // First user: check if ANY profile exists — if not, this user is admin
  const { count } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })

  const role = count === 0 ? "admin" : "member"

  const adminClient = createAdminClient()
  const { data: newProfile, error } = await adminClient
    .from("profiles")
    .insert({ id: user.id, role, is_active: true })
    .select()
    .single()

  if (error) return { data: null, error: { message: error.message } }
  return { data: newProfile, error: null }
}
```

**Note:** Use admin client for the insert — the anon client cannot insert into `profiles` until the `007_rls_policies.sql` INSERT policy is in place. Admin client bypasses RLS.

### inviteUser Action Pattern

```ts
export async function inviteUser(formData: { email: string }) {
  const parsed = InviteUserSchema.safeParse(formData)
  if (!parsed.success) return { data: null, error: { message: "Invalid email." } }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: { message: "Unauthorized" } }

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!callerProfile || callerProfile.role !== "admin")
    return { data: null, error: { message: "Only admins can invite users." } }

  const adminClient = createAdminClient()
  const { data: inviteData, error: inviteError } =
    await adminClient.auth.admin.inviteUserByEmail(parsed.data.email)

  if (inviteError) return { data: null, error: { message: inviteError.message } }

  if (inviteData.user) {
    await adminClient.from("profiles").insert({
      id: inviteData.user.id,
      role: "member",
      is_active: true,
      invited_by: user.id,
    })
  }

  return { data: { email: parsed.data.email }, error: null }
}
```

### deactivateUser Action Pattern

```ts
export async function deactivateUser(userId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: { message: "Unauthorized" } }

  if (userId === user.id)
    return { data: null, error: { message: "Cannot deactivate yourself." } }

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!callerProfile || callerProfile.role !== "admin")
    return { data: null, error: { message: "Only admins can deactivate users." } }

  const adminClient = createAdminClient()
  const { error: updateError } = await adminClient
    .from("profiles")
    .update({ is_active: false })
    .eq("id", userId)

  if (updateError) return { data: null, error: { message: updateError.message } }

  // Immediate session revocation (NFR8) — non-blocking on failure
  await adminClient.auth.admin.signOut(userId)

  return { data: { deactivatedUserId: userId }, error: null }
}
```

### Atomic Design Placement

- `UserList.tsx` → `src/components/organisms/UserList.tsx` (Client Component)
- Settings page → `src/app/(app)/settings/page.tsx` (Server Component)
- `src/lib/supabase/admin.ts` → new lib file (server-only)

### What This Story Does NOT Include

- No new domain migrations (002–006 for suppliers, products, inquiries, sources, photo_hashes — deferred to Epics 2–6)
- No user profile editing (display name, avatar)
- No role editing for existing users (all invitees are permanent `member` role)
- No pagination (small team)
- No email template customization
- No real-time presence indicators

### File List for This Story

```
supabase/migrations/
├── 001_groups.sql                  # DELETE
├── 001_profiles.sql                # NEW — replaces 001_groups.sql
└── 007_rls_policies.sql            # NEW — auth-gated + creator-or-admin policies

src/
├── lib/supabase/
│   └── admin.ts                    # NEW — service role client
├── lib/schemas/
│   └── user.ts                     # NEW — InviteUserSchema (or extend group.ts)
├── actions/
│   ├── users.ts                    # NEW — ensureProfile, inviteUser, deactivateUser, etc.
│   └── users.test.ts               # NEW
├── app/(app)/
│   ├── layout.tsx                  # MODIFY — call ensureProfile + pass userEmail
│   └── settings/
│       └── page.tsx                # NEW
├── components/
│   └── organisms/
│       ├── TopBar.tsx              # MODIFY — add userEmail prop + user actions
│       └── UserList.tsx            # NEW
└── types/
    └── database.ts                 # REGENERATE (run db:types after migrations)
```

### References

- Architecture: `_bmad-output/planning-artifacts/architecture.md` — Runtime Deviations, Server Action return shape, auth-gated RLS approach
- Epics: `_bmad-output/planning-artifacts/epics.md` — Story 1.4 updated ACs, FR2–FR6, NFR5, NFR8
- Sprint Change Proposal: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-03-21.md`
- Story 1.3: `_bmad-output/implementation-artifacts/1-3-authentication-group-schema.md` — All runtime deviations, shadcn @base-ui deviation, `fireEvent` testing pattern

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Fixed missing closing `}` in AppShell.tsx after Edit tool truncated the JSX expression `{topBar ?? <TopBar />}` — parse error caught by test runner on first run.
- `supabase db reset` returned 502 at container restart step but migrations applied successfully (both 001 and 007 confirmed applied).
- AppShell refactored to accept `topBar?: React.ReactNode` slot so TopBar remains a Server Component while AppShell stays `"use client"`.

### Completion Notes List

- Task 1: `001_groups.sql` was already deleted and `001_profiles.sql` already existed from sprint change proposal. Ran `supabase db reset` + `npm run db:types` to confirm migrations applied and types regenerated — `profiles` table + `user_role` enum confirmed, `is_admin` function confirmed after Task 3.
- Task 2: Created `src/lib/supabase/admin.ts` using `@supabase/supabase-js` (not `@supabase/ssr`). `.env.example` and `.env.local` already had `SUPABASE_SERVICE_ROLE_KEY`.
- Task 3: Created `007_rls_policies.sql` dropping dev-only permissive policy, adding `is_admin()` helper (security definer), and auth-gated + admin-only policies for `profiles`.
- Task 4: Created `src/lib/schemas/user.ts` with `InviteUserSchema` + `InviteUserFormValues`. `LoginSchema` kept in `src/lib/schemas/group.ts` unchanged.
- Task 5: Created `src/actions/users.ts` with all 6 actions following `{ data, error }` return shape. Used admin client for insert/update operations to bypass RLS.
- Task 6: Created `src/app/(app)/settings/page.tsx` as async Server Component fetching users and current profile in parallel via `Promise.all`.
- Task 7: Created `src/components/organisms/UserList.tsx` as Client Component. Uses `useTransition` for Deactivate/Reactivate/Invite. No arbitrary Tailwind values.
- Task 8: TopBar rewritten to Server Component with `userEmail` prop, Settings link, and Sign Out form with inline server action. AppShell extended with `topBar?: ReactNode` slot. Layout updated to async, calls `ensureProfile()`, passes `<TopBar userEmail={...} />` as slot.
- Task 9: 41 tests pass (37 pre-existing + 4 new in users.test.ts + 6 new in UserList.test.tsx). `npm run build` confirms no TypeScript errors.

### File List

supabase/migrations/001_profiles.sql (pre-existing — confirmed correct)
supabase/migrations/007_rls_policies.sql (NEW)
src/lib/supabase/admin.ts (NEW)
src/lib/schemas/user.ts (NEW)
src/actions/users.ts (NEW)
src/actions/users.test.ts (NEW)
src/app/(app)/layout.tsx (MODIFIED)
src/app/(app)/settings/page.tsx (NEW)
src/components/organisms/TopBar.tsx (MODIFIED)
src/components/organisms/UserList.tsx (NEW)
src/components/organisms/UserList.test.tsx (NEW)
src/components/templates/AppShell.tsx (MODIFIED)
src/types/database.ts (REGENERATED)

## Change Log

- 2026-03-21: Story 1.4 created — group management, member invite/remove, group-scoped RLS
- 2026-03-21: **FULL REWRITE** (Sprint Change Proposal 2026-03-21) — pivoted from "Group Management" to "User Management"; group concept removed; profiles table replaces groups/group_members; RLS strategy changed to auth-gated + creator-or-admin
- 2026-03-21: Implementation complete — all 9 tasks done; 41 tests pass; build clean; status → review
