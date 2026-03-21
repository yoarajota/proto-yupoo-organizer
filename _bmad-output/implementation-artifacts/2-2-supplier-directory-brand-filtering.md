# Story 2.2: Supplier Directory & Brand Filtering

Status: review

## Story

As a group member,
I want to browse all group suppliers in a filterable list,
so that I can quickly locate the right supplier for a research session.

## Acceptance Criteria

1. **Given** the Suppliers page, **When** it loads, **Then** all group suppliers render as `SupplierRow` components showing: name, brand tag chips, price range (if inquiry prices exist), active inquiry count, and red flag icon (FR12).

2. **Given** brand filter chips above the list, **When** I click a chip, **Then** the list filters immediately — no Apply button; active chip is filled, inactive is outlined (FR13).

3. **Given** the search field, **When** I type, **Then** the list filters in real time by supplier name.

4. **Given** no suppliers in the group, **When** the page loads, **Then** "Add your first supplier to get started" with a primary CTA ("Add Supplier") is shown (empty state).

5. **Given** a filtered list that returns no matches, **When** rendered, **Then** "No results for [filter/search]" message is shown with a "Clear filters" link.

6. **Given** a supplier with `is_flagged = true`, **When** shown in the directory, **Then** a red flag icon (error color, no background) is visible inline on the supplier's row.

## Tasks / Subtasks

- [x] Task 1: Extend `BrandTagChip` atom with filter variant (AC: #2)
  - [x] Add `variant` prop: `"display"` (default), `"filter"`, `"removable"` — filter variant shows filled when `active=true`, outlined when `active=false`
  - [x] Filter variant: filled = `bg-surface-container-high text-foreground border border-transparent`; outlined = `bg-transparent text-muted-foreground border border-border`
  - [x] Never use arbitrary Tailwind bracket values — all tokens must be in globals.css
  - [x] Backward-compatible: existing `display` variant (no `onRemove`) and `removable` variant (with `onRemove`) behavior unchanged

- [x] Task 2: Create `PriceRange` atom (AC: #1)
  - [x] Create `src/components/atoms/PriceRange.tsx`
  - [x] Props: `min: number`, `max: number`; formatted as "R$45–R$62" (single value if min === max: "R$45")
  - [x] Style: `font-semibold text-primary text-body-sm`; right-aligned when in a row context
  - [x] Use `Intl.NumberFormat` with `{ style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }` for number formatting

- [x] Task 3: Create `RedFlagIcon` atom (AC: #6)
  - [x] Create `src/components/atoms/RedFlagIcon.tsx`
  - [x] Renders a flag icon using an SVG or lucide-react flag icon — check what icon library is already used in `SideNav.tsx` or `TopBar.tsx` and use the SAME library
  - [x] Style: `text-error` (the semantic error token from globals.css); no background; no wrapper
  - [x] Props: `className?: string`

- [x] Task 4: Create `BrandTagGroup` molecule (AC: #1, #2)
  - [x] Create `src/components/molecules/BrandTagGroup.tsx`
  - [x] Props: `brands: string[]`, `selectedBrands?: string[]`, `onToggle?: (brand: string) => void`
  - [x] When `onToggle` is provided: renders `BrandTagChip` in `filter` variant per brand; clicking calls `onToggle(brand)`; chips with brand in `selectedBrands` show as active (filled), others as outlined
  - [x] When `onToggle` is NOT provided: renders `BrandTagChip` in `display` variant (read-only chips, no click handler) — used inside `SupplierRow` to show a supplier's brands
  - [x] Horizontal layout, wraps gracefully; gap between chips

- [x] Task 5: Create `SearchField` molecule (AC: #3)
  - [x] Create `src/components/molecules/SearchField.tsx` — Client Component (`"use client"`)
  - [x] Props: `value: string`, `onChange: (value: string) => void`, `placeholder?: string`
  - [x] Uses existing `<input>` or `src/components/ui/input.tsx` (check if input.tsx exists first — it does at `src/components/ui/input.tsx`)
  - [x] Has a search icon as a leading icon — use the same icon library as RedFlagIcon
  - [x] Renders as a contained search bar with the icon inset (icon inside input container, not outside)
  - [x] Clear button (✕) appears when value is not empty; clicking sets value to ""

- [x] Task 6: Create `SupplierRow` organism (AC: #1, #6)
  - [x] Create `src/components/organisms/SupplierRow.tsx` — Server Component compatible (no hooks needed at row level)
  - [x] Props:
    ```ts
    interface SupplierRowProps {
      supplier: SupplierRow  // Database["public"]["Tables"]["suppliers"]["Row"]
      priceRange?: { min: number; max: number }
      activeInquiryCount: number
    }
    ```
  - [x] Layout: horizontal row, `flex items-center justify-between`, bordered card look matching Story 2.1's list item style (`rounded-lg border border-border bg-surface-container-low px-4 py-3`)
  - [x] Left section: supplier name (`text-body-sm font-medium`) + `BrandTagGroup` (display mode) below name
  - [x] Right section: `PriceRange` (if priceRange provided) + active inquiry count badge + `RedFlagIcon` (if `is_flagged`) + `SupplierSheet` Edit button
  - [x] Active inquiry count: shown as a text label `"N active"` in `text-label-xs text-muted-foreground`; hidden if count is 0
  - [x] Clicking supplier name navigates to `/suppliers/[id]` — use Next.js `<Link>` from `next/link`
  - [x] `SupplierSheet` import: `import { SupplierSheet } from "@/components/organisms/SupplierSheet"` — already exists, reuse it with `supplier={supplier}` prop

- [x] Task 7: Create `SupplierDirectory` organism (AC: #1, #2, #3, #4, #5)
  - [x] Create `src/components/organisms/SupplierDirectory.tsx` — Client Component (`"use client"`) — manages filter/search state
  - [x] Props: `suppliers: SupplierWithStats[]`, `allBrands: string[]`, `addSupplierTrigger?: React.ReactNode`
  - [x] State: `searchTerm: string`, `selectedBrands: string[]`
  - [x] Filtering logic: name filter + brand filter, AND logic
  - [x] Render order: `SearchField` → `BrandTagGroup` (filter mode with all brand chips) → supplier list → empty/no-results state
  - [x] Empty state (no suppliers at all): "Add your first supplier to get started" centered message + `addSupplierTrigger`
  - [x] No-results state (filters active, nothing matches): "No results for [searchTerm or brand]" + "Clear filters" link (resets both `searchTerm` and `selectedBrands`)
  - [x] Supplier list: `<ul>` with `SupplierRow` per supplier; no visible borders between items, gap between rows

- [x] Task 8: Upgrade Suppliers page to use `SupplierDirectory` (AC: #1–#6)
  - [x] Modify `src/app/(app)/suppliers/page.tsx` — keep as async Server Component
  - [x] New data fetching: fetch suppliers AND inquiries in parallel with `Promise.all`
  - [x] Fetch inquiries for price range and active counts (cast to `any` — `inquiries` table added in Story 4.x)
  - [x] Compute `SupplierWithStats[]` with priceRange and activeInquiryCount
  - [x] Compute `allBrands`: `[...new Set(suppliers.flatMap(s => s.brands))].sort()`
  - [x] Page layout: heading + "Add Supplier" button row at top; `SupplierDirectory` below with `addSupplierTrigger` prop

- [x] Task 9: Write tests (AC: all)
  - [x] Create `src/components/organisms/SupplierRow.test.tsx` — test: renders supplier name; renders BrandTagChip for each brand; renders PriceRange when priceRange provided; renders RedFlagIcon when is_flagged; does NOT render PriceRange when no priceRange
  - [x] Create `src/components/organisms/SupplierDirectory.test.tsx` — test: search filters by name; brand chip click filters list; clicking active brand chip again clears filter; shows empty state when no suppliers; shows no-results state when filter produces nothing; "Clear filters" link resets state
  - [x] Use `fireEvent` from `@testing-library/react` — `@testing-library/user-event` is NOT installed
  - [x] Run `npm run test:run` — all 72 tests pass
  - [x] Run `npm run build` — no TypeScript errors

## Dev Notes

### What Already Exists (DO NOT Recreate)

- `src/components/atoms/BrandTagChip.tsx` — exists; needs filter variant added (Task 1)
- `src/components/molecules/BrandTagInput.tsx` — exists (for create/edit forms); DO NOT modify
- `src/components/organisms/SupplierSheet.tsx` — exists; import and reuse directly
- `src/components/ui/sheet.tsx` — exists
- `src/components/ui/button.tsx` — exists, `@base-ui/react/button`
- `src/components/ui/input.tsx` — exists; inspect before creating SearchField
- `src/lib/supabase/server.ts` — `async createClient()` — already correct, DO NOT touch
- `src/actions/suppliers.ts` — `createSupplier`, `updateSupplier` — DO NOT modify
- `src/lib/schemas/supplier.ts` — `SupplierSchema` — DO NOT modify
- `src/types/database.ts` — generated types including `suppliers` table — import from here
- `supabase/migrations/002_suppliers.sql` and `008_suppliers_rls.sql` — already applied; NO new migrations needed for this story
- `src/proxy.ts` — Next.js 16 middleware — **DO NOT touch**

### CRITICAL Runtime Deviations (ALL AGENTS MUST FOLLOW)

**1. Next.js 16 — middleware file is `src/proxy.ts`**
- `src/middleware.ts` does NOT exist and must NOT be created

**2. Tailwind v4 — tokens in `src/app/globals.css` via `@theme`**
- `tailwind.config.ts` is a placeholder — never add tokens there
- Zero arbitrary bracket values (`w-[240px]`, `text-[10px]`, etc.) anywhere in components
- Available named tokens: `text-label-xs`, `text-label-sm`, `text-body-sm`, `text-body-md`, `w-sidebar`, `w-sidebar-collapsed`, `bg-surface-container-low`, `bg-surface-container-lowest`, `bg-surface-container-high`, `text-muted-foreground`, `text-foreground`, `text-primary`, `border-border`, `text-error`, etc.
- Before using a token, check `src/app/globals.css` to confirm it's defined

**3. `@base-ui/react` — NOT `@radix-ui`**
- `asChild` prop does NOT exist
- Use `render` prop pattern: `<DialogTrigger render={<button>text</button>} />`

**4. `npx shadcn@latest add <anything>` FAILS on this project**
- Write ALL new UI components manually
- Reference existing `button.tsx`, `sheet.tsx`, `input.tsx` for patterns

**5. `@testing-library/user-event` is NOT installed**
- Use `fireEvent` from `@testing-library/react` only

**6. Next.js 16.2.1** — read `node_modules/next/dist/docs/` before using any unfamiliar API.

**7. `<Link>` from `next/link`** — use for supplier name clickable navigation to `/suppliers/[id]`; the Supplier Detail page (`/suppliers/[id]`) is built in Story 2.3; the link must exist in this story but it will 404 until 2.3 is done — that is acceptable.

### Icon Library Check

Before writing `RedFlagIcon` and the search icon in `SearchField`, check:
```bash
ls src/components/organisms/SideNav.tsx
# or grep for icon import
grep -r "from 'lucide-react'\|from \"lucide-react\"" src/
```
Use whatever icon library is already installed. If lucide-react is used, preferred icons: `Flag` for red flag, `Search` for search field, `X` for clear button.

### Data Fetching Pattern — Parallel Queries in Server Component

```ts
// src/app/(app)/suppliers/page.tsx
const supabase = await createClient()

const [
  { data: suppliers },
  { data: inquiriesWithPrice },
  { data: activeInquiries },
] = await Promise.all([
  supabase.from('suppliers').select('*').order('created_at', { ascending: false }),
  supabase.from('inquiries').select('supplier_id, price').not('price', 'is', null),
  supabase.from('inquiries').select('supplier_id, status').in('status', ['sent', 'price_received', 'negotiating']),
])
```

### `SupplierDirectory` — Empty vs No-Results States

- **Empty** (zero suppliers in DB): show "Add your first supplier to get started" + primary CTA
- **No-results** (suppliers exist but filters produce zero): show "No results for [filter]" + "Clear filters" link
- Distinguish these two cases by checking `suppliers.length` (total) vs `filtered.length`

### BrandTagChip Filter Variant Design

Filter chips for the `SupplierDirectory` filter bar (above the list):
- **Active (selected)**: `bg-surface-container-high text-foreground border border-transparent` — filled look
- **Inactive (not selected)**: `bg-transparent text-muted-foreground border border-border` — outlined look
- Clicking toggles selection; no separate Apply button needed
- Filter takes effect immediately on click

### SupplierRow — Price Range Formatting

Use `Intl.NumberFormat` with `BRL` currency. If prices are stored as numeric (could be integers or decimals), format as: `R$ 45 – R$ 62` or `R$45–R$62`. Check the UX spec token `PriceRange` atom: "R$45–R$62" formatted display, `font-semibold text-primary`.

### Atomic Design Placement

```
src/components/
  atoms/
    BrandTagChip.tsx          # MODIFY — add filter variant
    PriceRange.tsx            # NEW
    RedFlagIcon.tsx           # NEW
  molecules/
    BrandTagGroup.tsx         # NEW — horizontal chip list (filter + display modes)
    SearchField.tsx           # NEW — search bar with icon
  organisms/
    SupplierRow.tsx           # NEW — full supplier row (name, brands, price range, count, flag, edit)
    SupplierDirectory.tsx     # NEW — filterable supplier list
  ui/
    input.tsx                 # EXISTS — inspect before using in SearchField
```

### Story 2.2 Scope Boundary

This story does NOT include:
- Supplier Detail page `/suppliers/[id]` (Story 2.3)
- `TrustIntelligencePanel` — trust notes, red flag toggle, negotiation elasticity UI (Story 2.3)
- `NegotiationElasticity` molecule (Story 2.3)
- Any photo upload or product logic (Story 3.x)
- Inquiry creation or status management (Story 4.x)

### SideNav / Navigation

The SideNav already has a "Suppliers" link to `/suppliers`. No changes needed to SideNav.

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- TypeScript build failed: `inquiries` table not in generated `database.ts` (Story 4.x). Fixed by casting supabase client to `any` for inquiries queries with explicit typed local arrays.
- Test failure: "filters by name when typing in search" — test incorrectly expected "Multi Brand" when searching "Nike" (name-only filter per AC). Fixed test assertion.

### Completion Notes List

- Extended `BrandTagChip` with `variant` prop (`"display"` | `"filter"` | `"removable"`); filter variant renders as `<button>` with filled/outlined states; backward compatible.
- Created `PriceRange` atom with BRL `Intl.NumberFormat`; collapses to single value when min === max.
- Created `RedFlagIcon` atom using `lucide-react` `Flag` icon with `text-error` token.
- Created `BrandTagGroup` molecule; filter mode (with `onToggle`) vs display mode (read-only).
- Created `SearchField` molecule with `Search`/`X` icons from lucide-react; inset icon pattern.
- Created `SupplierRow` organism: name→link, BrandTagGroup (display), PriceRange, active count, RedFlagIcon, edit button.
- Created `SupplierDirectory` organism: manages `searchTerm` + `selectedBrands` state; empty vs no-results states; `addSupplierTrigger` prop for empty-state CTA.
- Upgraded Suppliers page with parallel `Promise.all` queries; `SupplierWithStats[]` computation.
- 72 tests pass (11 test files); build clean.

### File List

- `src/components/atoms/BrandTagChip.tsx` — modified (filter variant added)
- `src/components/atoms/PriceRange.tsx` — new
- `src/components/atoms/RedFlagIcon.tsx` — new
- `src/components/molecules/BrandTagGroup.tsx` — new
- `src/components/molecules/SearchField.tsx` — new
- `src/components/organisms/SupplierRow.tsx` — new
- `src/components/organisms/SupplierDirectory.tsx` — new
- `src/components/organisms/SupplierRow.test.tsx` — new
- `src/components/organisms/SupplierDirectory.test.tsx` — new
- `src/app/(app)/suppliers/page.tsx` — modified (parallel data fetch, SupplierDirectory)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — modified (status updates)

### Change Log

- 2026-03-21: Implemented Story 2.2 — Supplier Directory & Brand Filtering. Added filter variant to BrandTagChip; created PriceRange, RedFlagIcon atoms; BrandTagGroup, SearchField molecules; SupplierRow, SupplierDirectory organisms; upgraded Suppliers page with parallel queries and stats computation.
