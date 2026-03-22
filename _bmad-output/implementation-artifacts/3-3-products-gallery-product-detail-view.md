# Story 3.3: Products Gallery & Product Detail View

Status: review

## Story

As a group member,
I want to browse products visually in a gallery and see a product's full photo strip on detail,
so that I can find and recognize products by sight rather than by name.

## Acceptance Criteria

1. **Given** the Products page, **when** it loads, **then** products display in a uniform card grid (`GalleryTemplate`); each `ProductCard` shows: product photo, notes preview, and photo count (FR17 partial — supplier count deferred to Epic 4 when inquiries table is built).

2. **Given** no products, **when** the page loads, **then** "Upload your first product photos to get started" CTA is shown.

3. **Given** a `ProductCard`, **when** I click it, **then** I navigate to Product Detail showing `ProductPhotoStrip` (horizontal scrollable) at top and a notes field below.

4. **Given** the `ProductPhotoStrip`, **when** I click a thumbnail, **then** a Dialog opens with the full-size photo and prev/next navigation; pressing Escape or clicking the backdrop closes it.

## Tasks / Subtasks

- [x] Task 1: Create `ProductPhotoStrip` organism (AC: #3, #4)
  - [x] Create `src/components/organisms/ProductPhotoStrip.tsx` — Client Component (`"use client"`)
  - [x] Props interface:
    ```ts
    interface ProductPhotoStripProps {
      photos: Array<{ id: string; storage_path: string; alt_text: string }>
      supabaseUrl: string
    }
    ```
  - [x] State: `const [selectedIndex, setSelectedIndex] = useState<number | null>(null)`
  - [x] Render horizontal scrollable strip:
    ```tsx
    <div className="flex gap-2 overflow-x-auto py-1">
      {photos.map((photo, i) => (
        <PhotoThumb
          key={photo.id}
          src={`${supabaseUrl}/storage/v1/object/public/product-photos/${photo.storage_path}`}
          alt={photo.alt_text || `Product photo ${i + 1}`}
          size="lg"
          className="shrink-0 cursor-pointer"
          onClick={() => setSelectedIndex(i)}
        />
      ))}
    </div>
    ```
  - [x] Lightbox Dialog using `@base-ui/react/dialog` — controlled open state
  - [x] If `photos.length === 0`, render `<p className="text-body-sm text-muted-foreground">No photos yet.</p>`

- [x] Task 2: Update product detail page to use `ProductPhotoStrip` (AC: #3, #4)
  - [x] Open `src/app/(app)/products/[id]/page.tsx`
  - [x] Replace the current raw `<div className="flex gap-2 overflow-x-auto py-1">…</div>` block AND the `<p>No photos yet.</p>` fallback with `<ProductPhotoStrip>`
  - [x] Remove the `PhotoThumb` import if no longer used in this file after refactor
  - [x] Keep `PhotoUploadZone` and `ProductNotesForm` sections unchanged

- [x] Task 3: Update `ProductCard` to show photo count (AC: #1)
  - [x] Open `src/components/organisms/ProductCard.tsx`
  - [x] Add photo count to the card's info section below notes/date
  - [x] Keep all existing layout and logic unchanged — this is purely additive
  - [x] **Supplier count note:** The epics AC says "supplier count" but the inquiries table (Epic 4) does not exist yet. Show photo count as a meaningful visual metric for now. The supplier count will be wired in Epic 4, story 4.x when `createInquiry` and the `inquiries` table are available.

- [x] Task 4: Write tests (AC: all)
  - [x] Create `src/components/organisms/ProductPhotoStrip.test.tsx` with 5 test cases
  - [x] Run `npm run test:run` — all 101 tests pass (96 prior + 5 new)
  - [x] Run `npm run build` — zero TypeScript errors

## Dev Notes

### What Already Exists (DO NOT Recreate)

- `src/app/(app)/products/page.tsx` — **READ BEFORE TOUCHING.** Already has `GalleryTemplate`, `ProductCard` grid, empty state CTA, and `PhotoUploadZone`. AC #1 and #2 are already partially implemented. Only AC #1 needs the photo count addition to `ProductCard`.
- `src/app/(app)/products/[id]/page.tsx` — **MODIFY ONLY** to swap the raw photo div for `<ProductPhotoStrip>`. Everything else (PhotoUploadZone, ProductNotesForm, breadcrumb) stays unchanged.
- `src/components/organisms/ProductCard.tsx` — **MODIFY ONLY** to add photo count display. Do NOT change the card's layout structure, link, or image logic.
- `src/components/templates/GalleryTemplate.tsx` — use as-is; props: `title?: string`, `actions?: React.ReactNode`, `children: React.ReactNode`
- `src/components/templates/DetailTemplate.tsx` — use as-is; props: `breadcrumb: React.ReactNode`, `title: string`, `children: React.ReactNode`, `sideContent?: React.ReactNode`
- `src/actions/products.ts` — NO changes needed; exports: `createProduct`, `addProductPhoto`, `updateProduct`
- `src/components/atoms/PhotoThumb.tsx` — use as-is; props: `src`, `alt` (required), `size?: 'sm'|'md'|'lg'`, `className?`, `onClick?`. Note: `size='lg'` maps to `w-32 h-32` (hardcoded — not a token). This is an existing artifact from Story 3.1.
- `src/components/organisms/PhotoUploadZone.tsx` — use as-is; not touched in this story
- `src/components/organisms/ProductNotesForm.tsx` — use as-is; not touched in this story

### CRITICAL Runtime Deviations (ALL AGENTS MUST FOLLOW)

**1. Next.js 16 — async params (CRITICAL — will crash if wrong)**
```ts
export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params  // MUST await — never destructure directly
```
The existing `products/[id]/page.tsx` already does this correctly. Do NOT break it.

**2. Tailwind v4 — tokens in `src/app/globals.css` ONLY**
- `tailwind.config.ts` is a placeholder — NEVER add tokens there
- Zero arbitrary bracket values (`w-[320px]`, `text-[10px]`, etc.)
- Confirmed tokens from `globals.css`:
  - Sizing: `w-thumb-sm` (48px), `w-thumb-md` (64px)
  - Typography: `text-label-xs`, `text-label-sm`, `text-body-sm`, `text-body-md`
  - Colors: `text-muted-foreground`, `text-foreground`, `text-primary`, `text-error`, `border-border`
  - Surfaces: `bg-surface-container-low`, `bg-surface-container-lowest`, `bg-surface-container-high`
  - Gallery grid: `grid-cols-gallery` (maps to `--grid-template-columns-gallery: repeat(auto-fill, minmax(200px, 1fr))`)
- **Note:** `PhotoThumb` size `'lg'` renders `w-32 h-32` (a Tailwind spacing scale value, not a custom token). This already exists — do NOT try to replace it with a custom token.

**3. `@base-ui/react` — NOT `@radix-ui`**
- The Dialog API is `@base-ui/react/dialog` — same as `Sheet` uses internally at `src/components/ui/sheet.tsx`
- **No `asChild` prop** — use `render` prop pattern if wrapping, or just compose primitives directly
- `npx shadcn@latest add <anything>` FAILS — write all UI manually
- Pattern confirmed from `src/components/ui/sheet.tsx`:
  ```ts
  import { Dialog } from '@base-ui/react/dialog'
  // Available: Dialog.Root, Dialog.Trigger, Dialog.Portal, Dialog.Backdrop, Dialog.Popup, Dialog.Close, Dialog.Title
  ```
- For controlled open state: `<Dialog.Root open={bool} onOpenChange={(open) => { if (!open) closeHandler() }}>`
- `Dialog.Backdrop` and `Dialog.Popup` are siblings inside `Dialog.Portal`

**4. `@testing-library/user-event` is NOT installed**
- Use `fireEvent` from `@testing-library/react` ONLY

**5. Client vs Server component rules**
- `ProductPhotoStrip` MUST be a Client Component (`"use client"`) — it uses `useState` for lightbox
- `products/[id]/page.tsx` is a Server Component — passes `photo_hashes` data as props to `ProductPhotoStrip`
- Do NOT call `createClient()` from `@/lib/supabase/server` inside `ProductPhotoStrip`

**6. No `src/middleware.ts`**
- Middleware file is `src/proxy.ts` — DO NOT create `src/middleware.ts`

**7. Mock ALL products actions in tests**
```ts
vi.mock('@/actions/products', () => ({
  createProduct: vi.fn().mockResolvedValue({ data: {}, error: null }),
  addProductPhoto: vi.fn().mockResolvedValue({ data: {}, error: null }),
  updateProduct: vi.fn().mockResolvedValue({ data: {}, error: null }),
}))
```
Whenever any test file imports from `@/actions/products`, mock ALL three exports to avoid "undefined is not a function" errors across the test suite.

**8. `process.env.NEXT_PUBLIC_SUPABASE_URL` in Server Components**
- The products page and detail page already read `process.env.NEXT_PUBLIC_SUPABASE_URL!` and pass it down as a string prop
- `ProductPhotoStrip` receives `supabaseUrl: string` as a prop — never reads `process.env` directly
- In tests, pass `supabaseUrl="https://test.supabase.co"` directly

### Lightbox Design Specification

```
┌─────────────────────────────────────────────┐
│  (black/80 backdrop — entire viewport)       │
│                                             │
│        ┌─────────────────────┐  [✕]        │
│        │                     │             │
│        │   full-size image   │             │
│        │   (max-h-[80vh])    │             │
│        │                     │             │
│        └─────────────────────┘             │
│                                             │
│          [←]   2 / 3   [→]                 │
│                                             │
└─────────────────────────────────────────────┘
```

- Backdrop click closes (Dialog.Backdrop default behavior)
- Escape key closes (Dialog.Root default behavior)
- ← wraps from first → last; → wraps from last → first (circular navigation)
- Counter format: `{selectedIndex + 1} / {photos.length}`
- Close button positioned top-right of the image container with `absolute` positioning

### ProductPhotoStrip Placement

```
src/components/
  organisms/
    ProductPhotoStrip.tsx    # NEW — horizontal scrollable strip + Dialog lightbox
```

### Story Scope Boundary

This story does NOT include:
- Market Overview / price range callout — Epic 4 (requires inquiries table)
- Inquiry creation from product page — Epic 4
- Actual supplier count on ProductCard — Epic 4 (inquiries table needed)
- pHash computation or `SimilarityAdvisoryBanner` — Stories 6.1/6.2
- Product deletion or editing product name
- Mobile-specific lightbox behavior (swipe) — desktop MVP only

### Previous Story Learnings (from Stories 3.1 and 3.2)

- `onUploadProgress` does NOT work in the installed `@supabase/storage-js` — progress jumps 0→100. Not relevant for this story.
- Docker unavailable during Story 3.1 — `npx supabase@latest db push` was skipped. **No new migrations in this story**, so Docker is not needed.
- `npm run build` must succeed with **zero TypeScript errors** before marking story done
- `npm run test:run` must report all 96 prior tests passing + new tests
- Mock ALL exports from `@/actions/products` when mocking — prevents "undefined is not a function" in other tests
- `fireEvent` only — `@testing-library/user-event` is NOT installed
- `PhotoThumb` requires `alt` prop — TypeScript-enforced; always provide a fallback string

### DB Schemas (already applied — no new migrations)

```ts
// products Row:
{ id: string; notes: string | null; created_by: string; created_at: string; updated_at: string }

// photo_hashes Row:
{ id: string; product_id: string; storage_path: string; phash: string | null; alt_text: string; created_by: string; created_at: string; updated_at: string }
```

Storage URL pattern:
```
{NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-photos/{storage_path}
```

### File Changes Summary

| File | Action |
|------|--------|
| `src/components/organisms/ProductPhotoStrip.tsx` | CREATE — new organism |
| `src/components/organisms/ProductPhotoStrip.test.tsx` | CREATE — tests |
| `src/app/(app)/products/[id]/page.tsx` | MODIFY — swap raw div for `<ProductPhotoStrip>` |
| `src/components/organisms/ProductCard.tsx` | MODIFY — add photo count display |

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Added `import { describe, it, expect } from 'vitest'` to test file — vitest globals not enabled in this project (confirmed by checking existing test files)

### Completion Notes List

- Created `ProductPhotoStrip` organism: horizontal scrollable thumbnail strip + Dialog lightbox with prev/next circular navigation and Escape/backdrop close
- Updated `products/[id]/page.tsx`: replaced raw photo div with `<ProductPhotoStrip>`, removed `PhotoThumb` import
- Updated `ProductCard`: added photo count display below date (additive only)
- 5 new tests added; all 101 tests pass; `npm run build` zero TypeScript errors

### File List

- `src/components/organisms/ProductPhotoStrip.tsx` — CREATED
- `src/components/organisms/ProductPhotoStrip.test.tsx` — CREATED
- `src/app/(app)/products/[id]/page.tsx` — MODIFIED (swap raw div for ProductPhotoStrip, remove PhotoThumb import)
- `src/components/organisms/ProductCard.tsx` — MODIFIED (add photo count display)

### Change Log

- 2026-03-22: Implemented ProductPhotoStrip organism with lightbox, wired into product detail page, added photo count to ProductCard
