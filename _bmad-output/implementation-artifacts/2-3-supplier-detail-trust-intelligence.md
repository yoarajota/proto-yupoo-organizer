# Story 2.3: Supplier Detail & Trust Intelligence

Status: review

## Story

As a group member,
I want to view a supplier's full profile — trust notes, red flag, and negotiation elasticity,
so that I enter every negotiation informed about this supplier's reliability and price patterns.

## Acceptance Criteria

1. **Given** a supplier row, **When** I click the supplier name, **Then** I navigate to the Supplier Detail page (DetailTemplate layout) with breadcrumb "Suppliers > [Name]".

2. **Given** the Supplier Detail page, **When** it loads, **Then** the right column shows `TrustIntelligencePanel`: editable trust notes (Textarea), red flag Switch with source link field, and `NegotiationElasticity` display (opening price → final price with directional arrow + % avg) (FR9, FR10, FR11).

3. **Given** I edit trust notes and click Save, **When** `updateSupplier` confirms, **Then** the panel reflects the updated notes immediately (no full page reload required).

4. **Given** I toggle the red flag Switch, **When** I save, **Then** `is_flagged` is persisted; the source link field is visible only when `is_flagged = true`.

5. **Given** a supplier with a red flag, **When** viewed in the Supplier Directory (Story 2.2), **Then** the `RedFlagIcon` is visible inline — no change needed, already implemented.

6. **Given** the Supplier Detail page, **When** it loads with a valid supplier ID, **Then** the supplier name, Yupoo URL (external link), WhatsApp contact, and brand tags are displayed in the left/main column.

7. **Given** an invalid or non-existent supplier ID, **When** the page loads, **Then** Next.js `notFound()` is called.

## Tasks / Subtasks

- [x] Task 1: Create `DetailTemplate` (AC: #1, #2, #6)
  - [x] Create `src/components/templates/DetailTemplate.tsx` — Server Component (no hooks)
  - [x] Props: `breadcrumb: React.ReactNode`, `title: string`, `children: React.ReactNode`, `sideContent?: React.ReactNode`
  - [x] Layout: `max-w-5xl mx-auto px-4 py-6` outer container; breadcrumb row at top; `title` as `h1` (`text-body-md font-semibold`); below title: two-column grid (`grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6`)
  - [x] Left column: `children`; Right column: `sideContent`
  - [x] At sm/md breakpoint (single column): right column stacks below left

- [x] Task 2: Create `NegotiationElasticity` molecule (AC: #2)
  - [x] Create `src/components/molecules/NegotiationElasticity.tsx` — Server Component
  - [x] Props: `openingPrice?: number | null`, `finalPrice?: number | null`
  - [x] When both values are present: render "R$[opening] → R$[final]" with a `TrendingDown`/`TrendingUp` lucide-react icon based on direction + "([+/-]N% avg)" label
  - [x] Percentage calculation: `Math.round(((final - opening) / opening) * 100)`; negative = red (`text-error`), positive or 0 = green (`text-primary` or use `text-green-600` — check globals.css for a green token first)
  - [x] When either/both values are missing: render `<span className="text-label-sm text-muted-foreground">No elasticity data</span>`
  - [x] Format prices with `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 })`
  - [x] Use tokens from `globals.css` only — no arbitrary bracket values

- [x] Task 3: Create `TrustIntelligencePanel` organism (AC: #2, #3, #4)
  - [x] Create `src/components/organisms/TrustIntelligencePanel.tsx` — Client Component (`"use client"`)
  - [x] Props: `supplier: Database["public"]["Tables"]["suppliers"]["Row"]`
  - [x] Import type: `import type { Database } from "@/types/database"`
  - [x] Sections (vertically stacked, `flex flex-col gap-6`):
    - **Trust Notes**: label "Trust Notes" (`text-label-sm font-medium text-muted-foreground uppercase tracking-widest`), `<textarea>` with `defaultValue={supplier.trust_notes ?? ""}` + local state, placeholder "Add notes about this supplier's reliability…", Save button
    - **Red Flag**: label "Red Flag", `Switch` toggle bound to `isFlagged` state initialized from `supplier.is_flagged`; when `isFlagged = true` show URL input for `redFlagSource` (placeholder "Source link (e.g. scam report URL)")
    - **Negotiation Elasticity**: label "Price Elasticity", `<NegotiationElasticity openingPrice={supplier.negotiation_opening_price} finalPrice={supplier.negotiation_final_price} />`
  - [x] Save logic: separate save for trust notes section; red flag toggle auto-saves on change (no separate button)
  - [x] Both saves call `updateSupplier(supplier.id, { name: supplier.name, yupoo_url: supplier.yupoo_url, whatsapp_contact: supplier.whatsapp_contact, brands: supplier.brands ?? [], is_flagged: isFlagged, red_flag_source: redFlagSource ?? undefined, trust_notes: trustNotes ?? undefined, negotiation_opening_price: supplier.negotiation_opening_price ?? undefined, negotiation_final_price: supplier.negotiation_final_price ?? undefined })`
  - [x] Use `useTransition` → `isPending` drives Save button `disabled` + spinner/opacity
  - [x] On error: show inline error message below the relevant section
  - [x] Switch implementation: used `import { Switch } from "@base-ui/react/switch"` (correct named export pattern — `import * as` would require `.Switch.Root`)
  - [x] Section container style: `rounded-lg border border-border bg-surface-container-low p-4`

- [x] Task 4: Create Supplier Detail page (AC: #1, #6, #7)
  - [x] Create `src/app/(app)/suppliers/[id]/page.tsx` — async Server Component
  - [x] Import `notFound` from `next/navigation`
  - [x] Fetch: `const supabase = await createClient(); const { data: supplier } = await supabase.from('suppliers').select('*').eq('id', params.id).single()`
  - [x] If `!supplier`: call `notFound()`
  - [x] Render `DetailTemplate` with:
    - `breadcrumb`: `<><Link href="/suppliers" className="text-muted-foreground hover:text-foreground">Suppliers</Link> <span className="text-muted-foreground mx-1">›</span> <span>{supplier.name}</span></>`
    - `title`: `supplier.name`
    - `children` (main column): supplier info card with Yupoo URL (`<a href={supplier.yupoo_url} target="_blank" rel="noopener noreferrer">`), WhatsApp contact, `BrandTagGroup` (display mode, no onToggle), Edit button (reuse `SupplierSheet` with `supplier={supplier}` prop)
    - `sideContent`: `<TrustIntelligencePanel supplier={supplier} />`
  - [x] The `SupplierSheet` component accepts a `supplier` prop for edit mode — confirmed in Story 2.2 (import from `@/components/organisms/SupplierSheet`)
  - [x] Page params type: `{ params: Promise<{ id: string }> }` — Next.js 16 passes params as a Promise; destructure with `const { id } = await params`

- [x] Task 5: Update `revalidatePath` in `updateSupplier` action (AC: #3, #4)
  - [x] In `src/actions/suppliers.ts`, after `revalidatePath('/suppliers')` also add `revalidatePath('/suppliers/' + id)`
  - [x] The `id` parameter already exists in `updateSupplier(id: string, formData: SupplierFormValues)`

- [x] Task 6: Write tests (AC: all)
  - [x] Create `src/components/molecules/NegotiationElasticity.test.tsx`:
    - Test: renders "No elasticity data" when both prices null
    - Test: renders opening and final prices formatted as BRL
    - Test: shows negative % in red/error styling when final < opening
    - Test: shows positive % when final > opening
  - [x] Create `src/components/organisms/TrustIntelligencePanel.test.tsx`:
    - Test: renders trust notes textarea with supplier's existing notes
    - Test: renders red flag toggle; source link field hidden when `is_flagged = false`
    - Test: source link input appears when flag is toggled on
    - Test: shows NegotiationElasticity component
    - Mock `updateSupplier` action: `vi.mock("@/actions/suppliers", () => ({ updateSupplier: vi.fn().mockResolvedValue({ data: {}, error: null }) }))`
    - Use `fireEvent` from `@testing-library/react` (NOT `@testing-library/user-event` — not installed)
  - [x] Run `npm run test:run` — all 86 tests pass
  - [x] Run `npm run build` — no TypeScript errors

## Dev Notes

### What Already Exists (DO NOT Recreate)

- `src/components/atoms/BrandTagChip.tsx` — exists (display + filter + removable variants)
- `src/components/molecules/BrandTagGroup.tsx` — exists; import and use with no `onToggle` for display mode
- `src/components/atoms/RedFlagIcon.tsx` — exists; no change needed (already shows in SupplierRow)
- `src/components/atoms/PriceRange.tsx` — exists; NOT needed for this story (NegotiationElasticity has its own formatting)
- `src/components/organisms/SupplierSheet.tsx` — exists; accepts `supplier` prop for edit mode; import and reuse
- `src/components/ui/button.tsx` — exists (`@base-ui/react/button`); use for Save buttons
- `src/components/ui/input.tsx` — exists; use for red_flag_source URL input field
- `src/lib/supabase/server.ts` — `async createClient()` — DO NOT touch
- `src/actions/suppliers.ts` — `updateSupplier` — DO NOT change signature, only add `revalidatePath`
- `src/lib/schemas/supplier.ts` — `SupplierSchema` already includes all trust fields — DO NOT modify
- `src/types/database.ts` — generated types for `suppliers` table — import from here
- `src/proxy.ts` — Next.js 16 middleware — **DO NOT touch**

### CRITICAL Runtime Deviations (ALL AGENTS MUST FOLLOW)

**1. Next.js 16 — middleware file is `src/proxy.ts`**
- `src/middleware.ts` does NOT exist and must NOT be created

**2. Tailwind v4 — tokens in `src/app/globals.css` via `@theme`**
- `tailwind.config.ts` is a placeholder — never add tokens there
- Zero arbitrary bracket values (`w-[320px]`, `text-[10px]`, etc.) anywhere in components
- Available named tokens: `text-label-xs`, `text-label-sm`, `text-body-sm`, `text-body-md`, `w-sidebar`, `w-sidebar-collapsed`, `bg-surface-container-low`, `bg-surface-container-lowest`, `bg-surface-container-high`, `text-muted-foreground`, `text-foreground`, `text-primary`, `border-border`, `text-error`
- Before using a token, verify it exists in `src/app/globals.css`

**3. `@base-ui/react` — NOT `@radix-ui`**
- `asChild` prop does NOT exist
- Use `render` prop pattern: `<SomeComponent render={<button>text</button>} />`
- Button: `import { Button as ButtonPrimitive } from "@base-ui/react/button"` (see `src/components/ui/button.tsx` for pattern)

**4. `npx shadcn@latest add <anything>` FAILS on this project**
- Write ALL new UI components manually
- Reference existing `button.tsx`, `sheet.tsx`, `input.tsx` for patterns

**5. `@testing-library/user-event` is NOT installed**
- Use `fireEvent` from `@testing-library/react` only

**6. Next.js 16 async params**
- `params` in page components is a `Promise` in Next.js 16
- Must `await params` before destructuring: `const { id } = await params`
- Signature: `export default async function Page({ params }: { params: Promise<{ id: string }> })`

**7. Next.js 16.2.1** — read `node_modules/next/dist/docs/` before using any unfamiliar API

### Switch Component

Before implementing the Switch in `TrustIntelligencePanel`, check if `@base-ui/react/switch` exists:
```bash
ls node_modules/@base-ui/react/ | grep -i switch
```
- If it exists, import `Switch` from `@base-ui/react/switch` and check its compound component API
- If it does NOT exist, implement a simple accessible toggle:
  ```tsx
  <button
    type="button"
    role="switch"
    aria-checked={isFlagged}
    onClick={() => setIsFlagged(prev => !prev)}
    className={cn(
      "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
      isFlagged ? "bg-primary" : "bg-muted-foreground/30"
    )}
  >
    <span className={cn("inline-block h-4 w-4 rounded-full bg-white transition-transform", isFlagged ? "translate-x-4" : "translate-x-0.5")} />
  </button>
  ```

### Supplier Detail Page Layout

```
┌──────────────────────────────────────────┐
│ Suppliers › Nike Factory Shanghai        │  ← breadcrumb
│ Nike Factory Shanghai                    │  ← h1 title
├──────────────────────────────────────────┤
│ MAIN COLUMN        │ TrustIntelligence   │
│ ─────────────      │ ─────────────────── │
│ Yupoo URL [→link]  │ Trust Notes         │
│ WhatsApp: +86...   │ [textarea] [Save]   │
│ Brands: Nike…      │                     │
│ [Edit Supplier]    │ Red Flag [switch]   │
│                    │ Source: [input]     │
│                    │                     │
│                    │ Price Elasticity    │
│                    │ R$50 → R$45 ↓10%   │
└──────────────────────────────────────────┘
```

### updateSupplier Spread Pattern

When calling `updateSupplier` from `TrustIntelligencePanel`, spread the full supplier to satisfy all required schema fields:

```ts
await updateSupplier(supplier.id, {
  name: supplier.name,
  yupoo_url: supplier.yupoo_url,
  whatsapp_contact: supplier.whatsapp_contact,
  brands: supplier.brands ?? [],
  is_flagged: isFlagged,
  red_flag_source: redFlagSource || undefined,
  trust_notes: trustNotes || undefined,
  negotiation_opening_price: supplier.negotiation_opening_price ?? undefined,
  negotiation_final_price: supplier.negotiation_final_price ?? undefined,
})
```

### Data Fetching Pattern

```ts
// src/app/(app)/suppliers/[id]/page.tsx
export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: supplier } = await supabase
    .from('suppliers')
    .select('*')
    .eq('id', id)
    .single()

  if (!supplier) notFound()
  // ...
}
```

### Atomic Design Placement

```
src/components/
  molecules/
    NegotiationElasticity.tsx   # NEW — opening/final price with % arrow
  organisms/
    TrustIntelligencePanel.tsx  # NEW — trust notes + red flag + elasticity
  templates/
    DetailTemplate.tsx          # NEW — breadcrumb + title + two-column layout
```

### Story 2.3 Scope Boundary

This story does NOT include:
- Editing `negotiation_opening_price` / `negotiation_final_price` from the detail page (those come from the Supplier form in Story 2.1 / `SupplierSheet`)
- Linked inquiry history on supplier detail (Story 4.5)
- Any product or photo logic (Epic 3)
- Any inquiry creation or status management (Epic 4)

### Supplier Name Link (Story 2.2 Prerequisite)

`SupplierRow.tsx` already links supplier name to `/suppliers/[id]` via Next.js `<Link>` (implemented in Story 2.2). This story creates the destination page — no changes needed to `SupplierRow`.

### Previous Story Learnings (from Story 2.2)

- `lucide-react` is installed and is the icon library in use; use `TrendingUp`/`TrendingDown` for elasticity arrows
- `@testing-library/user-event` is NOT installed — confirmed; use `fireEvent` only
- `@base-ui/react` pattern uses NO `asChild` prop — confirmed; use `render` prop
- `src/components/ui/input.tsx` exists and works well for URL/text inputs
- The `SupplierSheet` component accepts `supplier` prop to prefill for edit mode

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- `@base-ui/react/switch` exports `{ Switch }` as a named export (not `* as`). The correct pattern is `import { Switch } from "@base-ui/react/switch"` and then use `Switch.Root` and `Switch.Thumb`.

### Completion Notes List

- Created `DetailTemplate` Server Component with responsive two-column grid layout (single column on mobile, `lg:grid-cols-[1fr_320px]` on desktop).
- Created `NegotiationElasticity` molecule: formats prices as BRL, calculates % change, shows `TrendingDown`/`TrendingUp` icons, uses `text-error` for negative and `text-primary` for positive (no green token in globals.css).
- Created `TrustIntelligencePanel` Client Component with `useTransition` for both trust notes save and red flag auto-save. Used `{ Switch } from "@base-ui/react/switch"` with `Switch.Root` / `Switch.Thumb` compound pattern.
- Created Supplier Detail page at `src/app/(app)/suppliers/[id]/page.tsx` with `await params` for Next.js 16 async params, `notFound()` for invalid IDs.
- Added `revalidatePath('/suppliers/' + id)` to `updateSupplier` action.
- All 86 tests pass, build clean.

### File List

- `src/components/templates/DetailTemplate.tsx` (new)
- `src/components/molecules/NegotiationElasticity.tsx` (new)
- `src/components/molecules/NegotiationElasticity.test.tsx` (new)
- `src/components/organisms/TrustIntelligencePanel.tsx` (new)
- `src/components/organisms/TrustIntelligencePanel.test.tsx` (new)
- `src/app/(app)/suppliers/[id]/page.tsx` (new)
- `src/actions/suppliers.ts` (modified — added `revalidatePath('/suppliers/' + id)`)

### Change Log

- 2026-03-21: Implemented Story 2.3 — Supplier Detail page with DetailTemplate layout, TrustIntelligencePanel (trust notes, red flag, negotiation elasticity), NegotiationElasticity molecule, and revalidatePath fix for supplier detail route.
