# Story 2.1: Create & Edit Supplier

Status: review

## Story

As a group member,
I want to create a supplier card with name, Yupoo URL, WhatsApp, and brand tags,
so that the group can start building its shared supplier directory.

## Acceptance Criteria

1. **Given** the Suppliers page, **When** I click "Add Supplier", **Then** a Sheet (side panel) opens with a form — only name, Yupoo URL, and WhatsApp are required; brand tags are optional (FR7, FR8).

2. **Given** the form, **When** I submit valid data, **Then** `createSupplier` Server Action runs; Sheet closes; supplier appears in the directory (page refreshes via `revalidatePath('/suppliers')`).

3. **Given** the form, **When** I leave a required field empty and blur, **Then** an inline validation error appears on that field; the form cannot submit.

4. **Given** the `suppliers` migration, **When** it runs, **Then** the table includes: `id`, `name`, `yupoo_url`, `whatsapp_contact`, `brands` (text[]), `trust_notes`, `is_flagged`, `red_flag_source`, `negotiation_opening_price`, `negotiation_final_price`, `created_by`, `created_at`, `updated_at`. RLS: auth-gated SELECT/INSERT; creator-or-admin UPDATE/DELETE.

5. **Given** an existing supplier, **When** I click Edit, **Then** the Sheet reopens prefilled; saving runs `updateSupplier`.

## Tasks / Subtasks

- [x] Task 1: Create suppliers migration (AC: #4)
  - [x] Create `supabase/migrations/002_suppliers.sql` — table + trigger + SELECT/INSERT policies (no `is_admin()` — see Dev Notes for exact SQL)
  - [x] Create `supabase/migrations/008_suppliers_rls.sql` — UPDATE/DELETE policies using `is_admin()` (must run after 007)
  - [x] Run `supabase db reset` to apply all migrations fresh
  - [x] Run `npm run db:types` to regenerate `src/types/database.ts`
  - [x] Verify `src/types/database.ts` contains `suppliers` table type

- [x] Task 2: Create Zod schema (AC: #3)
  - [x] Create `src/lib/schemas/supplier.ts` — `SupplierSchema` + `SupplierFormValues` type (see Dev Notes)

- [x] Task 3: Create Server Actions (AC: #2, #5)
  - [x] Create `src/actions/suppliers.ts` — `createSupplier`, `updateSupplier` exports (see Dev Notes)
  - [x] Both follow `{ data: T, error: null } | { data: null, error: { message: string } }` shape — NEVER throw

- [x] Task 4: Create Sheet UI component (AC: #1)
  - [x] Inspect `node_modules/@base-ui/react/` to find the available Dialog/Popup subpath
  - [x] Create `src/components/ui/sheet.tsx` — write manually using `@base-ui/react/dialog` (or equivalent); follows same pattern as `button.tsx` and `tooltip.tsx`; side panel that slides in from the right
  - [x] CANNOT use `npx shadcn@latest add sheet` — it FAILS on this project

- [x] Task 5: Create BrandTagChip atom and BrandTagInput molecule (AC: #1)
  - [x] Create `src/components/atoms/BrandTagChip.tsx` — display and removable variants; uses named tokens only; removable variant shows an ✕ button
  - [x] Create `src/components/molecules/BrandTagInput.tsx` — Client Component; text input + Enter/button to add a tag; renders added tags as removable `BrandTagChip`; manages `string[]` state; exposes `value` and `onChange` for RHF integration

- [x] Task 6: Create SupplierSheet organism (AC: #1, #2, #3, #5)
  - [x] Create `src/components/organisms/SupplierSheet.tsx` — Client Component (`"use client"`)
  - [x] Props: `supplier?: SupplierRow` — omit for create mode, provide for edit mode
  - [x] React Hook Form with `mode: 'onBlur'`; integrated with `SupplierSchema` via `@hookform/resolvers/zod`
  - [x] Fields: name (required), yupoo_url (required), whatsapp_contact (required), brands (`BrandTagInput`, optional)
  - [x] On submit: calls `createSupplier` or `updateSupplier` via `useTransition`; close Sheet and show inline error if action returns error
  - [x] Submit button disabled while `isPending`; never disable entire form — only the submit button

- [x] Task 7: Create Suppliers page (AC: #1, #2)
  - [x] Create `src/app/(app)/suppliers/page.tsx` — async Server Component
  - [x] Fetch all suppliers via server Supabase client, ordered by `created_at DESC`
  - [x] Render page heading + "Add Supplier" button that opens `SupplierSheet`
  - [x] Render minimal supplier list (just name + Edit button using `SupplierSheet supplier={s}` prop) — full `SupplierRow` with brand chips / inquiry count built in Story 2.2
  - [x] Add SideNav link for "Suppliers" → `/suppliers` if not already present

- [x] Task 8: Write tests (AC: all)
  - [x] Create `src/actions/suppliers.test.ts` — mock Supabase client; test `createSupplier` returns error for missing required fields; test return shape is always `{ data, error }` (never throws)
  - [x] Create `src/components/organisms/SupplierSheet.test.tsx` — test inline validation error on empty required field blur; test Sheet opens on "Add Supplier" click; test submit calls `createSupplier`
  - [x] Use `fireEvent` from `@testing-library/react` — `@testing-library/user-event` is NOT installed
  - [x] Run `npm run test:run` — all tests pass
  - [x] Run `npm run build` — no TypeScript errors

## Dev Notes

### What Already Exists (DO NOT Recreate)

- `src/lib/supabase/server.ts` — `async createClient()` with `await cookies()` — already correct
- `src/lib/supabase/admin.ts` — `createAdminClient()` using `@supabase/supabase-js` (not `@supabase/ssr`) — already correct
- `src/lib/supabase/client.ts` — browser client — already correct
- `src/proxy.ts` — Next.js 16 middleware — **DO NOT touch**
- `src/actions/groups.ts` — `signIn`, `signOut` — **DO NOT modify**
- `src/actions/users.ts` — all user management actions — **DO NOT modify**
- `src/lib/schemas/user.ts` — `InviteUserSchema` pattern — **follow this pattern** for `SupplierSchema`
- `src/components/ui/button.tsx` — `@base-ui/react/button` — reference for UI component patterns
- `src/components/ui/tooltip.tsx` — `@base-ui/react/tooltip` — reference for UI component patterns
- `supabase/migrations/007_rls_policies.sql` — defines `is_admin()` function — **DO NOT redefine** this function

### CRITICAL Runtime Deviations (Stories 1.1–1.4 — ALL AGENTS MUST FOLLOW)

**1. Next.js 16 — middleware file is `src/proxy.ts`, function named `proxy`**
- `src/middleware.ts` does NOT exist and must NOT be created — it is ignored by Next.js 16.

**2. Next.js 16 async cookies** — already handled in `server.ts`:
```ts
export async function createClient() {
  const cookieStore = await cookies() // MUST await
  ...
}
```

**3. Tailwind v4 — tokens in `src/app/globals.css` via `@theme`**
- `tailwind.config.ts` is a placeholder — never add tokens there
- Available named tokens: `text-label-xs`, `text-label-sm`, `text-body-sm`, `text-body-md`, `w-sidebar`, `w-sidebar-collapsed`, `bg-surface-container-low`, `bg-surface-container-lowest`, `bg-surface-container-high`, `text-muted-foreground`, etc.
- Zero arbitrary bracket values anywhere in components

**4. shadcn uses `@base-ui/react`, NOT `@radix-ui`**
- `asChild` prop does NOT exist
- Use `render` prop pattern: `<DialogTrigger render={<button>text</button>} />`
- `@radix-ui/react-slot` is NOT installed
- Import paths: `@base-ui/react/dialog`, `@base-ui/react/button`, `@base-ui/react/tooltip`, etc.

**5. `npx shadcn@latest add <anything>` FAILS on this project**
- Write ALL new UI components manually
- Follow existing patterns in `button.tsx` and `tooltip.tsx`
- For the Sheet component, use `@base-ui/react/dialog` — run `ls node_modules/@base-ui/react/` to discover available subpaths

**6. `@testing-library/user-event` is NOT installed**
- Use `fireEvent` from `@testing-library/react` only

**7. Next.js 16.2.1** — read `node_modules/next/dist/docs/` before using any unfamiliar API.

### Migration Ordering — Why Two Files

Supabase migrations run in filename alphabetical order. `007_rls_policies.sql` defines `is_admin()`. Our suppliers table must be created in `002_suppliers.sql` (before 007), so `is_admin()` does not yet exist when 002 runs. Therefore:

- `002_suppliers.sql` — table creation + `update_updated_at` trigger + SELECT/INSERT policies (safe, no `is_admin()` needed)
- `008_suppliers_rls.sql` — UPDATE/DELETE policies (runs after 007, `is_admin()` is available)

### 002_suppliers.sql

```sql
-- 002_suppliers.sql
create table suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  yupoo_url text not null,
  whatsapp_contact text not null,
  brands text[] not null default '{}',
  trust_notes text,
  is_flagged boolean not null default false,
  red_flag_source text,
  negotiation_opening_price numeric,
  negotiation_final_price numeric,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table suppliers enable row level security;

-- update_updated_at function already defined in 001_profiles.sql — reuse it
create trigger suppliers_updated_at
  before update on suppliers
  for each row execute function update_updated_at();

-- Auth-gated SELECT and INSERT (no is_admin() needed)
create policy "Auth users can read suppliers"
  on suppliers for select
  using (auth.uid() is not null);

create policy "Auth users can insert suppliers"
  on suppliers for insert
  with check (auth.uid() is not null);
```

### 008_suppliers_rls.sql

```sql
-- 008_suppliers_rls.sql
-- Runs after 007_rls_policies.sql — is_admin() is available here

create policy "Creator or admin can update suppliers"
  on suppliers for update
  using (created_by = auth.uid() or is_admin());

create policy "Creator or admin can delete suppliers"
  on suppliers for delete
  using (created_by = auth.uid() or is_admin());
```

### Zod Schema — src/lib/schemas/supplier.ts

```ts
import { z } from 'zod'

export const SupplierSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  yupoo_url: z.string().url('Must be a valid URL'),
  whatsapp_contact: z.string().min(1, 'WhatsApp contact is required'),
  brands: z.array(z.string()).default([]),
  trust_notes: z.string().optional(),
  is_flagged: z.boolean().default(false),
  red_flag_source: z.string().optional(),
  negotiation_opening_price: z.coerce.number().optional(),
  negotiation_final_price: z.coerce.number().optional(),
})

export type SupplierFormValues = z.infer<typeof SupplierSchema>
```

### Server Actions — src/actions/suppliers.ts

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { SupplierSchema, type SupplierFormValues } from '@/lib/schemas/supplier'

export async function createSupplier(formData: SupplierFormValues) {
  const parsed = SupplierSchema.safeParse(formData)
  if (!parsed.success) return { data: null, error: { message: 'Invalid form data.' } }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: { message: 'Unauthorized' } }

  const { data, error } = await supabase
    .from('suppliers')
    .insert({ ...parsed.data, created_by: user.id })
    .select()
    .single()

  if (error) return { data: null, error: { message: error.message } }
  revalidatePath('/suppliers')
  return { data, error: null }
}

export async function updateSupplier(id: string, formData: SupplierFormValues) {
  const parsed = SupplierSchema.safeParse(formData)
  if (!parsed.success) return { data: null, error: { message: 'Invalid form data.' } }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: { message: 'Unauthorized' } }

  const { data, error } = await supabase
    .from('suppliers')
    .update(parsed.data)
    .eq('id', id)
    .select()
    .single()

  if (error) return { data: null, error: { message: error.message } }
  revalidatePath('/suppliers')
  return { data, error: null }
}
```

### @base-ui/react Dialog for Sheet

Verify available subpaths: `ls node_modules/@base-ui/react/` — expect to find `dialog`, `button`, `tooltip`, `popup`, etc.

The Sheet pattern using Dialog:
```tsx
import { Dialog } from '@base-ui/react/dialog'

// Open state controlled externally
<Dialog.Root open={open} onOpenChange={setOpen}>
  <Dialog.Trigger render={<Button>Add Supplier</Button>} />
  <Dialog.Portal>
    <Dialog.Backdrop />
    <Dialog.Popup className="fixed right-0 top-0 h-full w-80 bg-background shadow-lg p-6">
      <Dialog.Title>Add Supplier</Dialog.Title>
      {/* form */}
    </Dialog.Popup>
  </Dialog.Portal>
</Dialog.Root>
```

**Note:** If `@base-ui/react/dialog` has different API, adapt from the actual package. Always check `node_modules/@base-ui/react/dialog/index.d.ts` for the real API.

### Atomic Design Placement

```
src/components/
  atoms/
    BrandTagChip.tsx          # NEW — display + removable variants
  molecules/
    BrandTagInput.tsx         # NEW — multi-tag text input
  organisms/
    SupplierSheet.tsx         # NEW — create/edit form in Sheet
  ui/
    sheet.tsx                 # NEW — base UI Sheet component
```

### Story 2.1 Scope Boundary

This story does NOT include:
- `SupplierRow` organism with brand chips, price range, inquiry count (Story 2.2)
- `SupplierDirectory` organism with brand filtering + search (Story 2.2)
- `TrustIntelligencePanel` — trust notes, red flag, negotiation elasticity UI (Story 2.3)
- `NegotiationElasticity` molecule (Story 2.3)
- Supplier Detail page `/suppliers/[id]` (Story 2.3)

The suppliers page in 2.1 is minimal — name + Edit button only — to satisfy "supplier appears in the directory" AC. Story 2.2 upgrades it to the full SupplierRow design.

### SideNav Update

Check `src/components/organisms/SideNav.tsx` — if "Suppliers" nav item is missing, add a link to `/suppliers`. Do not change the SideNav structure, only add the missing item if absent.

### References

- [Source: `_bmad-output/planning-artifacts/architecture.md`] — Runtime Deviations, Server Action return shape, RLS pattern, Atomic Design placement, naming conventions
- [Source: `_bmad-output/planning-artifacts/epics.md`] — Story 2.1 ACs, FR7, FR8, Epic 2 business context
- [Source: `_bmad-output/implementation-artifacts/1-4-group-management-admin.md`] — All runtime deviations, @base-ui pattern, `fireEvent` testing, admin client, RLS migration pattern

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Created suppliers DB migration (002) with full schema, RLS trigger, and SELECT/INSERT policies
- Created 008_suppliers_rls.sql for UPDATE/DELETE policies that depend on is_admin() (runs after 007)
- Applied db reset and regenerated types — suppliers table confirmed in database.ts
- SupplierSchema: removed .default() from brands/is_flagged/negotiation_prices to avoid RHF resolver type mismatch with z.coerce; defaultValues handled in useForm
- Sheet component built manually with @base-ui/react/dialog — Root, Trigger, Portal, Backdrop, Popup, Title, Close
- BrandTagChip atom supports display + removable variants using named Tailwind tokens only
- BrandTagInput molecule manages string[] state, integrates with RHF via Controller
- SupplierSheet organism: create/edit modes, onBlur validation, useTransition for async submit
- Suppliers page: async Server Component, fetches sorted suppliers, renders minimal list with Edit button
- SideNav already had /suppliers link — no change needed
- Tests: 7 action tests + 7 component tests, all 57 total pass; build clean

### File List

- supabase/migrations/002_suppliers.sql
- supabase/migrations/008_suppliers_rls.sql
- src/types/database.ts (regenerated)
- src/lib/schemas/supplier.ts
- src/actions/suppliers.ts
- src/components/ui/sheet.tsx
- src/components/atoms/BrandTagChip.tsx
- src/components/molecules/BrandTagInput.tsx
- src/components/organisms/SupplierSheet.tsx
- src/app/(app)/suppliers/page.tsx
- src/actions/suppliers.test.ts
- src/components/organisms/SupplierSheet.test.tsx

### Change Log

- 2026-03-21: Implemented Story 2.1 — suppliers migration, Zod schema, Server Actions (createSupplier/updateSupplier), Sheet UI component, BrandTagChip atom, BrandTagInput molecule, SupplierSheet organism, Suppliers page. All ACs satisfied; 57 tests pass; build clean.
