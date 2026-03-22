# Story 3.2: Add Photos & Notes to Existing Product

Status: review

## Story

As a group member,
I want to add more photos and free-text notes to an existing product card,
so that the product's visual identity and context can grow over time.

## Acceptance Criteria

1. **Given** a product detail page, **When** I click "Add Photos", **Then** the `PhotoUploadZone` is shown; new photos upload and append to the product's photo strip via `addProductPhoto` (FR15).

2. **Given** a notes field on the product detail page, **When** I type and save, **Then** notes are persisted via `updateProduct` and displayed below the photo strip (FR16).

3. **Given** a failed additional upload, **When** one file fails in a multi-file batch, **Then** previously completed uploads are unaffected; only the failed photo is absent (NFR9).

## Tasks / Subtasks

- [x] Task 1: Add `addProductPhoto` and `updateProduct` to `src/actions/products.ts` (AC: #1, #2, #3)
  - [x] Add `addProductPhoto(productId: string, storagePath: string, altText: string)` — append to the EXISTING file:
    ```ts
    export async function addProductPhoto(productId: string, storagePath: string, altText: string) {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return { data: null, error: { message: 'Unauthorized' } }

      const { data: hash, error: hashError } = await supabase
        .from('photo_hashes')
        .insert({ product_id: productId, storage_path: storagePath, alt_text: altText, created_by: user.id })
        .select()
        .single()

      if (hashError) {
        await supabase.storage.from('product-photos').remove([storagePath])
        return { data: null, error: { message: hashError.message } }
      }

      revalidatePath('/products')
      revalidatePath(`/products/${productId}`)
      return { data: hash, error: null }
    }
    ```
  - [x] Add `updateProduct(productId: string, values: ProductUpdateValues)`:
    ```ts
    import type { ProductUpdateValues } from '@/lib/schemas/product'

    export async function updateProduct(productId: string, values: ProductUpdateValues) {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return { data: null, error: { message: 'Unauthorized' } }

      const { data, error } = await supabase
        .from('products')
        .update({ notes: values.notes })
        .eq('id', productId)
        .select()
        .single()

      if (error) return { data: null, error: { message: error.message } }
      // Note: updated_at auto-set by products_updated_at trigger (DO NOT manually set it)
      revalidatePath('/products')
      revalidatePath(`/products/${productId}`)
      return { data, error: null }
    }
    ```
  - [x] **RLS note:** `products` update policy is `created_by = auth.uid() OR is_admin()`. If the current user is neither, Supabase returns `{ data: null, error: null }` with 0 rows — treat this as "not found or unauthorized" and surface a meaningful error message.

- [x] Task 2: Extend `PhotoUploadZone` to support adding to an existing product (AC: #1, #3)
  - [x] Open `src/components/organisms/PhotoUploadZone.tsx` — add optional `productId?: string` to props interface:
    ```ts
    interface PhotoUploadZoneProps {
      onUploadComplete?: () => void
      productId?: string   // if present → append to existing product via addProductPhoto
    }
    ```
  - [x] In `uploadFile`, branch on `productId`:
    ```ts
    // import addProductPhoto at top of file alongside createProduct import
    import { createProduct, addProductPhoto } from '@/actions/products'

    // inside uploadFile, replace the createProduct call:
    const result = productId
      ? await addProductPhoto(productId, storagePath, file.name)
      : await createProduct(storagePath, file.name)
    ```
  - [x] All existing behavior (progress, error display, `router.refresh()`, `onUploadComplete`) unchanged
  - [x] Existing 90 tests must still pass — this change is additive, not breaking

- [x] Task 3: Create `ProductNotesForm` organism (AC: #2)
  - [x] Create `src/components/organisms/ProductNotesForm.tsx` — Client Component (`"use client"`)
  - [x] Imports:
    ```ts
    import { useForm } from 'react-hook-form'
    import { zodResolver } from '@hookform/resolvers/zod'
    import { useTransition } from 'react'
    import { ProductUpdateSchema, type ProductUpdateValues } from '@/lib/schemas/product'
    import { updateProduct } from '@/actions/products'
    ```
  - [x] Props: `productId: string`, `initialNotes: string`
  - [x] Form setup:
    ```ts
    const [isPending, startTransition] = useTransition()
    const [saveError, setSaveError] = useState<string | null>(null)
    const form = useForm<ProductUpdateValues>({
      resolver: zodResolver(ProductUpdateSchema),
      defaultValues: { notes: initialNotes },
    })
    ```
  - [x] Submit handler (optimistic — no toast per UX spec):
    ```ts
    function onSubmit(data: ProductUpdateValues) {
      setSaveError(null)
      startTransition(async () => {
        const result = await updateProduct(productId, data)
        if (result.error) setSaveError(result.error.message)
      })
    }
    ```
  - [x] Layout (no arbitrary Tailwind values — use tokens from `globals.css`):
    ```tsx
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2">
      <label className="text-label-sm text-muted-foreground block">Notes</label>
      <textarea
        {...form.register('notes')}
        className="w-full rounded-md border border-border bg-surface-container-lowest p-2 text-body-sm text-foreground resize-none"
        rows={4}
        placeholder="Add notes about this product…"
      />
      {saveError && <p className="text-label-xs text-error">{saveError}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="text-body-sm font-medium text-primary disabled:opacity-50"
      >
        {isPending ? 'Saving…' : 'Save'}
      </button>
    </form>
    ```
  - [x] Use `<textarea>` directly (not `@base-ui/react`) — avoids render-prop complexity for a simple form field

- [x] Task 4: Implement product detail page (AC: #1, #2)
  - [x] Replace `src/app/(app)/products/[id]/page.tsx` (currently just `notFound()`) with:
    ```tsx
    import { notFound } from 'next/navigation'
    import Link from 'next/link'
    import { createClient } from '@/lib/supabase/server'
    import { DetailTemplate } from '@/components/templates/DetailTemplate'
    import { PhotoThumb } from '@/components/atoms/PhotoThumb'
    import { PhotoUploadZone } from '@/components/organisms/PhotoUploadZone'
    import { ProductNotesForm } from '@/components/organisms/ProductNotesForm'

    export default async function ProductDetailPage({
      params,
    }: {
      params: Promise<{ id: string }>
    }) {
      const { id } = await params   // CRITICAL: Next.js 16 async params

      const supabase = await createClient()
      const { data: product } = await supabase
        .from('products')
        .select('*, photo_hashes(*)')
        .eq('id', id)
        .single()

      if (!product) notFound()

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!

      return (
        <DetailTemplate
          breadcrumb={
            <Link href="/products" className="hover:text-foreground transition-colors">
              Products
            </Link>
          }
          title="Product"
        >
          <div className="space-y-6">
            {/* Photo row */}
            {product.photo_hashes.length > 0 ? (
              <div className="flex gap-2 overflow-x-auto py-1">
                {product.photo_hashes.map((photo, i) => (
                  <PhotoThumb
                    key={photo.id}
                    src={`${supabaseUrl}/storage/v1/object/public/product-photos/${photo.storage_path}`}
                    alt={photo.alt_text || `Product photo ${i + 1}`}
                    size="lg"
                    className="shrink-0"
                  />
                ))}
              </div>
            ) : (
              <p className="text-body-sm text-muted-foreground">No photos yet.</p>
            )}

            {/* Add photos */}
            <PhotoUploadZone productId={id} />

            {/* Notes */}
            <ProductNotesForm
              productId={id}
              initialNotes={product.notes ?? ''}
            />
          </div>
        </DetailTemplate>
      )
    }
    ```
  - [x] No changes needed to `ProductCard` — it already links to `/products/${product.id}`

- [x] Task 5: Write tests (AC: all)
  - [x] Create `src/components/organisms/ProductNotesForm.test.tsx`:
    ```ts
    vi.mock('@/actions/products', () => ({
      createProduct: vi.fn(),
      addProductPhoto: vi.fn(),
      updateProduct: vi.fn().mockResolvedValue({ data: {}, error: null }),
    }))
    ```
    - Render with `productId="abc"` and `initialNotes="existing note"` — verify textarea value is "existing note"
    - Click Save → verify `updateProduct` called with `('abc', { notes: 'existing note' })`
    - Use `fireEvent.click` (NOT `userEvent`) for submit
  - [x] Add tests to `src/components/organisms/PhotoUploadZone.test.tsx` for `productId` mode:
    - When `productId` prop is provided and file is dropped, `addProductPhoto` is called (not `createProduct`)
    - Mock `addProductPhoto` from `@/actions/products`; verify it is called with `productId`
  - [x] Run `npm run test:run` — all 90 existing tests pass + new tests
  - [x] Run `npm run build` — zero TypeScript errors

## Dev Notes

### What Already Exists (DO NOT Recreate)

- `src/actions/products.ts` — **ADD** `addProductPhoto` and `updateProduct` to this existing file; do NOT recreate it
- `src/lib/schemas/product.ts` — `ProductUpdateSchema` + `ProductUpdateValues` already exported; import directly
- `src/components/organisms/PhotoUploadZone.tsx` — **MODIFY** to add `productId` prop; do NOT create a new component
- `src/components/atoms/PhotoThumb.tsx` — use as-is; `alt` prop is required (TypeScript-enforced)
- `src/components/templates/DetailTemplate.tsx` — props: `breadcrumb: React.ReactNode`, `title: string`, `children: React.ReactNode`, `sideContent?: React.ReactNode`; two-column layout `grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6`
- `src/components/templates/GalleryTemplate.tsx` — NOT needed here
- `src/lib/supabase/server.ts` — `async createClient()` — DO NOT modify
- `src/lib/supabase/client.ts` — browser `createClient()` — already used in `PhotoUploadZone`
- `lucide-react` — installed
- `react-hook-form` + `@hookform/resolvers/zod` — installed (used in Epic 2 supplier forms)
- 90 tests currently pass — must NOT break any

### CRITICAL Runtime Deviations (ALL AGENTS MUST FOLLOW)

**1. Next.js 16 — async params (CRITICAL — will crash if wrong)**
```ts
// Product detail page signature:
export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params  // MUST await
```

**2. Tailwind v4 — tokens in `src/app/globals.css` ONLY**
- `tailwind.config.ts` is a placeholder — NEVER add tokens there
- Zero arbitrary bracket values (`w-[320px]`, `text-[10px]`, etc.)
- Always read `src/app/globals.css` to verify a token exists before using it
- Confirmed tokens: `text-label-xs`, `text-label-sm`, `text-body-sm`, `text-body-md`, `w-thumb-sm`, `w-thumb-md`, `bg-surface-container-low`, `bg-surface-container-lowest`, `bg-surface-container-high`, `text-muted-foreground`, `text-foreground`, `text-primary`, `border-border`, `text-error`

**3. `@base-ui/react` — NOT `@radix-ui`**
- No `asChild` prop — use `render` prop pattern for base-ui components
- `npx shadcn@latest add <anything>` FAILS — write all UI manually
- Using plain `<textarea>` in `ProductNotesForm` is correct; no base-ui import needed

**4. `@testing-library/user-event` is NOT installed**
- Use `fireEvent` from `@testing-library/react` ONLY

**5. Client vs Server Supabase client**
- `ProductNotesForm` is Client Component — do NOT import from `@/lib/supabase/server`
- Product detail page is a Server Component — use `await createClient()` from `@/lib/supabase/server`
- `PhotoUploadZone` is Client Component — already uses `createClient()` from `@/lib/supabase/client`

**6. No `src/middleware.ts`**
- Middleware file is `src/proxy.ts` — DO NOT create `src/middleware.ts`

**7. `updated_at` auto-update via trigger**
- `products` table has a `products_updated_at` trigger (defined in `003_products.sql`) that fires BEFORE UPDATE and calls `update_updated_at()`
- Do NOT manually set `updated_at` in `updateProduct` — the trigger handles it
- Architecture rule "never `new Date()` in Server Actions" is respected; trigger is the mechanism

**8. RLS update policy is creator-or-admin only**
- `products` update policy: `created_by = auth.uid() OR is_admin()` (in `003_products.sql`)
- If a non-creator non-admin tries to save notes, Supabase returns `{ data: null, error: null }` with PGRST116 or empty result
- Handle gracefully: if `data` is null after update, return `{ data: null, error: { message: 'Permission denied — only the product creator can edit notes' } }`

### Upload Atomicity for `addProductPhoto` (NFR9 — CRITICAL)

```
Client (PhotoUploadZone — productId mode)
  1. User selects files
  2. For each file (parallel): supabase.storage.from('product-photos').upload(path, file)
  3a. Storage SUCCESS → call addProductPhoto(productId, path, file.name)
  3b. Storage FAILURE → show inline error; STOP — never call addProductPhoto

Server (addProductPhoto Action)
  1. Insert into photo_hashes: { product_id: productId, storage_path, alt_text, created_by }
  2a. INSERT SUCCESS → revalidatePath × 2; return { data: hash, error: null }
  2b. INSERT FAIL → delete storage file (rollback); return error
```

AC #3 ("previously completed uploads unaffected") is automatically satisfied: each file runs as an independent Promise in `Promise.all`. Failure in one file's chain does not affect others.

### Product Detail Page Layout

```
┌──────────────────────────────────────────┐
│ ← Products  /  Product                   │  ← DetailTemplate breadcrumb + title
│                                          │
│  ┌────┐  ┌────┐  ┌────┐  ...             │  ← flex overflow-x-auto row of PhotoThumb lg
│  └────┘  └────┘  └────┘                  │
│                                          │
│ ┌──────────────────────────────────────┐ │  ← PhotoUploadZone (productId={id})
│ │  📷  Drop photos here to add more   │ │
│ └──────────────────────────────────────┘ │
│                                          │
│  Notes                                   │  ← ProductNotesForm
│  ┌────────────────────────────────────┐  │
│  │ ...                                │  │
│  └────────────────────────────────────┘  │
│  [ Save ]                                │
└──────────────────────────────────────────┘
```

### Atomic Design Placement

```
src/components/
  organisms/
    PhotoUploadZone.tsx     # MODIFIED — add productId prop
    ProductNotesForm.tsx    # NEW — notes textarea + save, Client Component
```

### Story 3.2 Scope Boundary

This story does NOT include:
- `ProductPhotoStrip` organism (horizontal scrollable + lightbox Dialog) — Story 3.3
- Photo lightbox / Dialog on thumbnail click — Story 3.3
- Market Overview / price range callout — Epic 4
- Inquiry creation from product page — Epic 4
- pHash computation or `SimilarityAdvisoryBanner` — Stories 6.1/6.2
- Product deletion

### Previous Story Learnings (from Story 3.1)

- `onUploadProgress` does NOT work in the installed `@supabase/storage-js` version — progress jumps 0→100 on upload completion. Same behavior will apply to `addProductPhoto` path; acceptable for MVP.
- Docker unavailable during Story 3.1 — `npx supabase@latest db push` was skipped; `src/types/database.ts` was manually updated. If Docker is unavailable again, manually verify types are current — `products` and `photo_hashes` types already exist in `database.ts`.
- `npm run build` must succeed with **zero TypeScript errors** before marking story done
- `npm run test:run` must report all 90 prior tests + new tests passing
- When mocking `@/actions/products` in tests, mock ALL exports from the module to avoid "undefined is not a function" in other tests that import the same module:
  ```ts
  vi.mock('@/actions/products', () => ({
    createProduct: vi.fn().mockResolvedValue({ data: {}, error: null }),
    addProductPhoto: vi.fn().mockResolvedValue({ data: {}, error: null }),
    updateProduct: vi.fn().mockResolvedValue({ data: {}, error: null }),
  }))
  ```
- `fireEvent` only — `@testing-library/user-event` is NOT installed

### DB Migrations (no new migrations needed)

- `003_products.sql` — products table + `products_updated_at` trigger + update/delete RLS policies — already applied
- `004_photo_hashes.sql` — photo_hashes table with insert policy for all authenticated users — already applied
- No new migrations required for this story

### DB Types (already in `src/types/database.ts`)

```ts
// products Row:
{ id: string; notes: string | null; created_by: string; created_at: string; updated_at: string }

// photo_hashes Row:
{ id: string; product_id: string; storage_path: string; phash: string | null; alt_text: string; created_by: string; created_at: string; updated_at: string }
```

### Project Structure Notes

- Product detail page is at `src/app/(app)/products/[id]/page.tsx` — already created as placeholder in Story 3.1 (returns `notFound()`)
- New organism goes in `src/components/organisms/ProductNotesForm.tsx`
- No navigation changes needed — `ProductCard` already links to `/products/${product.id}` from Story 3.1

### References

- Upload atomicity pattern: `_bmad-output/planning-artifacts/architecture.md` — "Upload atomicity (NFR9 — critical)"
- `addProductPhoto` action destination: architecture.md — `src/actions/products.ts` exports list
- `DetailTemplate` props: `src/components/templates/DetailTemplate.tsx` (read before using)
- Next.js 16 async params: Story 3.1 Dev Notes — CRITICAL Runtime Deviation #5
- Tailwind tokens: `src/app/globals.css` (authoritative source — always read before using a token)
- UX feedback patterns: ux-design-specification.md — "Successful save: Optimistic update — field updates immediately, no toast"
- RLS update policy: `supabase/migrations/003_products.sql` lines 25–27

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

(none)

### Completion Notes List

- Implemented `addProductPhoto` and `updateProduct` server actions in `src/actions/products.ts`; added RLS null-data guard for permission denied scenario
- Extended `PhotoUploadZone` with optional `productId` prop; branches to `addProductPhoto` when present, `createProduct` otherwise — all existing behavior unchanged
- Created `ProductNotesForm` client component with react-hook-form + zod, optimistic save, inline error display
- Implemented product detail page at `src/app/(app)/products/[id]/page.tsx` using Next.js 16 async params, shows photo strip, upload zone, and notes form
- All 96 tests pass (90 prior + 6 new); zero TypeScript build errors

### File List

- `src/actions/products.ts` (modified)
- `src/components/organisms/PhotoUploadZone.tsx` (modified)
- `src/components/organisms/ProductNotesForm.tsx` (new)
- `src/components/organisms/ProductNotesForm.test.tsx` (new)
- `src/components/organisms/PhotoUploadZone.test.tsx` (modified)
- `src/app/(app)/products/[id]/page.tsx` (modified)

### Change Log

- 2026-03-22: Story 3.2 implemented — product detail page with add photos and notes functionality (96 tests pass, zero TS errors)
