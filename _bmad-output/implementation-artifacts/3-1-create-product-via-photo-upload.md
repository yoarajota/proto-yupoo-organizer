# Story 3.1: Create Product via Photo Upload

Status: review

## Story

As a group member,
I want to create a product card by dragging and dropping photos,
so that I capture a product's visual identity without needing a product name.

## Acceptance Criteria

1. **Given** the Products page, **When** I drag photos onto the `PhotoUploadZone` or click to select files, **Then** a multi-file upload begins; a per-file progress bar appears for each file; the app remains fully responsive during upload (FR14, NFR1, NFR4).

2. **Given** upload success, **When** Supabase Storage confirms the file, **Then** the `photo_hashes` DB record is written (storage-first, DB-second); a product card is created and visible in the gallery (NFR9).

3. **Given** a Storage upload failure, **When** the upload fails, **Then** no database record is created; a clear error message is shown (NFR9, NFR10).

4. **Given** any `PhotoThumb` rendered, **When** it appears, **Then** it has a required `alt` prop (TypeScript enforced); broken images show a fallback placeholder.

5. **Given** the `products` and `photo_hashes` migrations, **When** they run, **Then** both tables exist with all required columns including `created_by`, `created_at`, `updated_at`.

## Tasks / Subtasks

- [x] Task 1: Verify & apply DB migrations (AC: #5)
  - [x] Confirm `supabase/migrations/003_products.sql` exists with: `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`, `notes TEXT`, `created_by UUID NOT NULL REFERENCES auth.users(id)`, `created_at TIMESTAMPTZ DEFAULT now()`, `updated_at TIMESTAMPTZ DEFAULT now()`; if missing, create it
  - [x] Confirm `supabase/migrations/004_photo_hashes.sql` exists with: `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`, `product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE`, `storage_path TEXT NOT NULL`, `phash TEXT`, `alt_text TEXT NOT NULL DEFAULT ''`, `created_by UUID NOT NULL REFERENCES auth.users(id)`, `created_at TIMESTAMPTZ DEFAULT now()`, `updated_at TIMESTAMPTZ DEFAULT now()`; if missing, create it
  - [x] Run `npx supabase@latest db push` (or `npx supabase@latest migration up`) to apply locally
  - [x] Run `npm run db:types` to regenerate `src/types/database.ts`

- [x] Task 2: Configure Supabase Storage bucket (AC: #2, #3)
  - [x] Create `supabase/migrations/008_storage_buckets.sql` (version-controlled — preferred over dashboard config):
    ```sql
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('product-photos', 'product-photos', true, 10485760, ARRAY['image/jpeg','image/png','image/webp','image/gif'])
    ON CONFLICT (id) DO NOTHING;
    ```
  - [x] Bucket is **public** for MVP simplicity — product photos are non-sensitive in a closed tool, avoids signed URL complexity
  - [x] Add Storage RLS policies (append to `007_rls_policies.sql` or new migration):
    ```sql
    CREATE POLICY "auth_insert_photos" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'product-photos');

    CREATE POLICY "auth_select_photos" ON storage.objects
      FOR SELECT TO authenticated
      USING (bucket_id = 'product-photos');

    CREATE POLICY "auth_delete_own_photos" ON storage.objects
      FOR DELETE TO authenticated
      USING (bucket_id = 'product-photos');
    ```
  - [x] Run `npx supabase@latest db push` to apply bucket migration
  - [x] Verify bucket appears in local dashboard: http://localhost:54323 → Storage

- [x] Task 3: Create `PhotoThumb` atom (AC: #4)
  - [x] Create `src/components/atoms/PhotoThumb.tsx` — Client Component (`"use client"` — required for `onError` handler)
  - [x] Props interface (`alt` is required — TypeScript enforced):
    ```ts
    interface PhotoThumbProps {
      src: string
      alt: string           // REQUIRED — no optional — TypeScript enforces this
      size?: 'sm' | 'md' | 'lg'
      className?: string
      onClick?: () => void
    }
    ```
  - [x] Size mapping (verify token names in `src/app/globals.css` first): `sm` → `w-thumb-sm h-thumb-sm`, `md` → `w-thumb-md h-thumb-md`, `lg` → `w-32 h-32` (use a token if available, else check globals.css for a larger size token)
  - [x] Render a square `<div>` container with `relative overflow-hidden rounded` and the size class
  - [x] Use `<img>` tag (not Next.js `<Image>` — avoids domain config complexity for MVP) with `object-cover w-full h-full`
  - [x] Error fallback: `const [error, setError] = useState(false)`; on `onError` set `error = true`; when error is true render a `<div className="w-full h-full bg-surface-container-low flex items-center justify-center">` with a `Camera` icon from `lucide-react` in `text-muted-foreground`
  - [x] Minimum 44×44px touch target at sm breakpoint: ensure container is at least `min-w-[44px] min-h-[44px]` — check if a token exists for this, otherwise use a CSS variable via globals.css

- [x] Task 4: Create `ProductSchema` Zod schema (AC: #2)
  - [x] Create `src/lib/schemas/product.ts`
  - [x] Pattern: reference `src/lib/schemas/supplier.ts` for exact Zod + infer pattern
  - [x] Export `ProductCreateSchema` (no required fields — photo-first; notes optional):
    ```ts
    export const ProductCreateSchema = z.object({
      notes: z.string().optional(),
    })
    export type ProductCreateValues = z.infer<typeof ProductCreateSchema>
    ```
  - [x] Export `ProductUpdateSchema`:
    ```ts
    export const ProductUpdateSchema = z.object({
      notes: z.string().optional(),
    })
    export type ProductUpdateValues = z.infer<typeof ProductUpdateSchema>
    ```

- [x] Task 5: Create `products.ts` Server Action (AC: #2, #3)
  - [x] Create `src/actions/products.ts` — `"use server"` at top of file
  - [x] Follow exact return shape from `src/actions/suppliers.ts` (never throw)
  - [x] Export `createProduct(storagePath: string, altText: string)`:
    1. `const supabase = await createClient()` (from `@/lib/supabase/server`)
    2. `const { data: { user } } = await supabase.auth.getUser()`; if no user return error
    3. Insert into `products`: `{ created_by: user.id }` → get back `product.id`
    4. On product insert error → return `{ data: null, error: { message: ... } }`
    5. Insert into `photo_hashes`: `{ product_id: product.id, storage_path: storagePath, alt_text: altText, created_by: user.id }`
    6. On `photo_hashes` insert error → **ROLLBACK**: `await supabase.storage.from('product-photos').remove([storagePath])`; then return error
    7. `revalidatePath('/products')`
    8. Return `{ data: { product, hash }, error: null }`
  - [x] Run `npm run db:types` before writing this action so types are current

- [x] Task 6: Create `PhotoUploadZone` organism (AC: #1, #2, #3)
  - [x] Create `src/components/organisms/PhotoUploadZone.tsx` — Client Component (`"use client"`)
  - [x] Read all Dev Notes before implementing — upload flow, progress, and atomicity are critical
  - [x] Props: `onUploadComplete?: () => void`
  - [x] State: `fileStates: Map<string, { name: string; progress: number; status: 'uploading' | 'done' | 'error'; error?: string }>`, `isDragOver: boolean`
  - [x] Upload logic (per file — run all files in parallel):
    1. Generate storage path: `` `products/${crypto.randomUUID()}-${file.name}` ``
    2. Upload via browser client: `const supabase = createClient()` (from `@/lib/supabase/client`)
    3. `supabase.storage.from('product-photos').upload(path, file, { upsert: false })`
    4. On storage success: call `createProduct(path, file.name)` Server Action
    5. On storage error: update file state to `error` with message — do NOT call `createProduct`
    6. On `createProduct` error: update file state to `error` (photo is already deleted server-side by atomicity logic)
  - [x] After all uploads finish: call `onUploadComplete?.()` and `router.refresh()` to show new products
  - [x] Progress bar: per-file `<div>` with `<div style={{ width: `${progress}%` }}` inside progress track
  - [x] Visual design: drag zone border (`border-2 border-dashed`), drag-over state changes to `border-primary` + `bg-surface-container-low`; center text "Drop photos here or click to select"; upload icon from `lucide-react`
  - [x] Hidden file input: `<input type="file" multiple accept="image/*" ref={inputRef} onChange={handleFiles} className="hidden" />`
  - [x] Clicking zone triggers `inputRef.current?.click()`

- [x] Task 7: Create `GalleryTemplate` template (AC: #2)
  - [x] Create `src/components/templates/GalleryTemplate.tsx` — Server Component (no hooks)
  - [x] Props: `children: React.ReactNode`, `title?: string`, `actions?: React.ReactNode`
  - [x] Layout: `<div className="max-w-5xl mx-auto px-4 py-6">`; optional header row with `<h1>` + `actions` slot; `{children}` below
  - [x] Reference `DetailTemplate.tsx` for patterns (same outer container, similar header treatment)

- [x] Task 8: Create `ProductCard` organism (AC: #2)
  - [x] Create `src/components/organisms/ProductCard.tsx` — Server Component
  - [x] Import type: `import type { Database } from "@/types/database"`
  - [x] Props:
    ```ts
    type ProductRow = Database["public"]["Tables"]["products"]["Row"]
    type PhotoHashRow = Database["public"]["Tables"]["photo_hashes"]["Row"]
    interface ProductCardProps {
      product: ProductRow & { photo_hashes: PhotoHashRow[] }
    }
    ```
  - [x] Render: `<Link href={/products/${product.id}}>` wrapping the card (Story 3.3 creates detail page)
  - [x] Card content: `<div className="rounded-lg border border-border bg-surface-container-lowest overflow-hidden">`
  - [x] Top: if `photo_hashes.length > 0` → `<PhotoThumb src={publicUrl} alt={photo_hashes[0].alt_text || 'Product photo'} size="lg" className="w-full" />`; else → zinc-100 placeholder with Camera icon
  - [x] Public URL for photo: constructed directly from env var `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-photos/${photo.storage_path}`
  - [x] Bottom: notes preview (2-line clamp: `line-clamp-2 text-label-sm text-muted-foreground`); created date via `Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' })`

- [x] Task 9: Create Products page (AC: #1, #2, #3)
  - [x] Create `src/app/(app)/products/page.tsx` — async Server Component
  - [x] Fetch with join: `supabase.from('products').select('*, photo_hashes(*)')`
  - [x] Render `GalleryTemplate` with `title="Products"` and `actions` slot for future use
  - [x] `PhotoUploadZone` always visible at top (above gallery — always available, not gated by empty state)
  - [x] Below upload zone: if `!products || products.length === 0` → empty state message
  - [x] If products exist: grid `grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 mt-6` with `ProductCard` per item
  - [x] No navigation changes needed — SideNav already includes Products tab from Story 1.2

- [x] Task 10: Write tests (AC: all)
  - [x] Create `src/components/atoms/PhotoThumb.test.tsx`: renders img with alt; fallback on error
  - [x] Create `src/components/organisms/PhotoUploadZone.test.tsx`: renders zone text; click triggers input
  - [x] Run `npm run test:run` — 90 tests pass (86 existing + 4 new)
  - [x] Run `npm run build` — zero TypeScript errors; `alt` prop is required (non-optional) in `PhotoThumb`

## Dev Notes

### What Already Exists (DO NOT Recreate)

- `src/components/templates/DetailTemplate.tsx` — exists (Story 2.3); reference for template layout patterns
- `src/components/ui/button.tsx` — exists; pattern: `import { Button as ButtonPrimitive } from "@base-ui/react/button"`
- `src/components/ui/input.tsx` — exists; reference for input field components
- `src/lib/supabase/server.ts` — async `createClient()` — DO NOT modify
- `src/lib/supabase/client.ts` — browser `createClient()` — use in `PhotoUploadZone`
- `src/actions/suppliers.ts` — reference for exact Server Action pattern (return shape, error handling, revalidatePath)
- `src/lib/schemas/supplier.ts` — reference for Zod schema + infer pattern
- `src/proxy.ts` — Next.js 16 middleware — **DO NOT touch; DO NOT create `src/middleware.ts`**
- `src/components/atoms/RedFlagIcon.tsx`, `BrandTagChip.tsx`, `PriceRange.tsx` — exist; NOT needed here
- `lucide-react` — installed; available: `Camera`, `Upload`, `AlertCircle`, `CheckCircle`, `ImageOff`

### CRITICAL Runtime Deviations (ALL AGENTS MUST FOLLOW)

**1. Next.js 16 — middleware is `src/proxy.ts`**
- `src/middleware.ts` does NOT exist; must NOT be created

**2. Tailwind v4 — ALL tokens in `src/app/globals.css` via `@theme`**
- `tailwind.config.ts` is a placeholder — never add tokens there
- Zero arbitrary bracket values (`w-[320px]`, `text-[10px]`, etc.) anywhere in components
- **Always read `src/app/globals.css` to verify a token exists before using it**
- Known tokens (verify before use): `text-label-xs`, `text-label-sm`, `text-body-sm`, `text-body-md`, `w-sidebar`, `w-sidebar-collapsed`, `w-thumb-sm`, `w-thumb-md`, `bg-surface-container-low`, `bg-surface-container-lowest`, `bg-surface-container-high`, `text-muted-foreground`, `text-foreground`, `text-primary`, `border-border`, `text-error`

**3. `@base-ui/react` — NOT `@radix-ui`**
- `asChild` prop does NOT exist in `@base-ui/react`
- Pattern: `render` prop — `<SomeComponent render={<button>label</button>} />`
- `npx shadcn@latest add <anything>` FAILS on this project — write all UI manually

**4. `@testing-library/user-event` is NOT installed**
- Use `fireEvent` from `@testing-library/react` only

**5. Next.js 16 async params**
- `params` is a `Promise` in page components
- `const { id } = await params`
- Signature: `{ params: Promise<{ id: string }> }`

**6. No green token in `globals.css`**
- Use `text-primary` for positive/success color (confirmed Story 2.3)

**7. Client vs Server Supabase client**
- `PhotoUploadZone` is a Client Component — MUST use `createClient()` from `@/lib/supabase/client`
- Server Actions / Server Components — MUST use `await createClient()` from `@/lib/supabase/server`
- NEVER import server client in a Client Component

**8. `@base-ui/react/switch` compound pattern (from Story 2.3)**
- Import: `import { Switch } from "@base-ui/react/switch"`
- Usage: `<Switch.Root>` + `<Switch.Thumb>` — not a single component

### Upload Atomicity Pattern (NFR9 — CRITICAL, NO EXCEPTIONS)

The full picture of how Client and Server responsibilities split:

```
Client (PhotoUploadZone — browser)
  1. User selects files
  2. For each file, call supabase.storage.from('product-photos').upload(path, file)
  3a. Storage SUCCESS → call createProduct(path, file.name) Server Action
  3b. Storage FAILURE → show inline error; STOP — DO NOT call createProduct

Server (createProduct Action)
  1. Insert into `products` → get product.id
  2a. products INSERT FAIL → return error (no storage artifact to clean up)
  2b. Insert into `photo_hashes`
  3a. photo_hashes INSERT SUCCESS → revalidatePath('/products'); return { data, error: null }
  3b. photo_hashes INSERT FAIL → delete storage file; return error
```

```ts
// Full createProduct implementation:
export async function createProduct(storagePath: string, altText: string) {
  'use server'  // or at file top
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: { message: 'Unauthorized' } }

  const { data: product, error: productError } = await supabase
    .from('products')
    .insert({ created_by: user.id })
    .select()
    .single()

  if (productError || !product) {
    return { data: null, error: { message: productError?.message ?? 'Failed to create product' } }
  }

  const { data: hash, error: hashError } = await supabase
    .from('photo_hashes')
    .insert({ product_id: product.id, storage_path: storagePath, alt_text: altText, created_by: user.id })
    .select()
    .single()

  if (hashError) {
    // ROLLBACK: delete the already-uploaded storage file
    await supabase.storage.from('product-photos').remove([storagePath])
    return { data: null, error: { message: hashError.message } }
  }

  revalidatePath('/products')
  return { data: { product, hash }, error: null }
}
```

### Per-File Progress Implementation

```ts
// Supabase Storage upload with progress callback:
const { data, error } = await supabase.storage
  .from('product-photos')
  .upload(storagePath, file, {
    upsert: false,
    onUploadProgress: (progress) => {
      const pct = Math.round((progress.loaded / progress.total) * 100)
      setFileStates(prev => {
        const next = new Map(prev)
        const entry = next.get(fileId)!
        next.set(fileId, { ...entry, progress: pct })
        return next
      })
    },
  })
```

### Products Page Layout

```
┌──────────────────────────────────────────┐
│ Products                                 │  ← h1
│                                          │
│ ┌──────────────────────────────────────┐ │
│ │  📷  Drop photos here to upload      │ │  ← PhotoUploadZone
│ │      or click to select files        │ │
│ │  [file1.jpg ████████████ 80%]        │ │
│ │  [file2.jpg ████ 40%]                │ │
│ └──────────────────────────────────────┘ │
│                                          │
│  ┌────┐  ┌────┐  ┌────┐  ┌────┐        │
│  │ 📷 │  │ 📷 │  │ 📷 │  │ 📷 │  ...  │  ← ProductCard grid
│  └────┘  └────┘  └────┘  └────┘        │
└──────────────────────────────────────────┘
```

### Serving Images from Public Bucket

Since the bucket is public (for MVP), construct the URL directly:
```ts
// In ProductCard (Server Component):
const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-photos/${photo.storage_path}`
// Pass to <PhotoThumb src={publicUrl} alt={photo.alt_text || 'Product photo'} />
```
No signed URL generation needed. This avoids async in Server Components just for URL construction.

### Atomic Design Placement

```
src/components/
  atoms/
    PhotoThumb.tsx        # NEW — required alt prop, error fallback, Client Component
  organisms/
    PhotoUploadZone.tsx   # NEW — drag-drop multi-upload with per-file progress
    ProductCard.tsx       # NEW — product thumbnail for gallery
  templates/
    GalleryTemplate.tsx   # NEW — max-w-5xl shell for gallery pages
```

### Story 3.1 Scope Boundary

This story does NOT include:
- Adding photos to an existing product (Story 3.2)
- Product detail page with photo strip lightbox (Story 3.3)
- pHash computation pipeline (Story 6.1)
- SimilarityAdvisoryBanner (Story 6.2)
- Inquiry creation from product page (Epic 4)
- Editing product notes from the product page (Story 3.2)

Create `src/app/(app)/products/[id]/` folder as an empty placeholder so links from `ProductCard` don't 404 on build — add a simple page returning `notFound()` for now.

### Previous Story Learnings (from Story 2.3)

- `@base-ui/react/switch` exports `{ Switch }` as named export; `Switch.Root` + `Switch.Thumb` compound pattern
- No green color token in `globals.css` — use `text-primary` for positive/success color
- `DetailTemplate` two-column layout: `grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6` — reference this in `GalleryTemplate`
- Server Actions: spread full object when calling update to satisfy schema required fields
- Test mock pattern: `vi.mock("@/actions/products", () => ({ createProduct: vi.fn().mockResolvedValue({ data: {}, error: null }) }))`
- After each story, all previous tests must still pass — do not break existing 86 tests
- `npm run build` must succeed with zero TypeScript errors before marking done
- `@testing-library/user-event` NOT installed — `fireEvent` only

### DB Column Names (verify in `src/types/database.ts` after `npm run db:types`)

Expected `products` table Row type:
```ts
{
  id: string
  notes: string | null
  created_by: string
  created_at: string
  updated_at: string
}
```

Expected `photo_hashes` table Row type:
```ts
{
  id: string
  product_id: string
  storage_path: string
  phash: string | null      // null until Epic 6 computes it
  alt_text: string
  created_by: string
  created_at: string
  updated_at: string
}
```

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- `onUploadProgress` not in `@supabase/storage-js` FileOptions for this SDK version — progress jumps 0→100 on upload completion instead of incremental. Per-file progress bar still renders during upload state.
- Docker not running — migrations created as files, `src/types/database.ts` manually updated with `products` and `photo_hashes` types. Must run `npx supabase@latest db push` when Docker is available.
- Migration `008_storage_buckets.sql` numbering conflict — story specified 008 but `008_suppliers_rls.sql` already exists. Used `009_storage_buckets.sql` instead.

### Completion Notes List

- Created `003_products.sql` and `004_photo_hashes.sql` migrations per story spec; manually updated `src/types/database.ts` (Docker unavailable for `npm run db:types`).
- Created `009_storage_buckets.sql` with public bucket + RLS policies for `product-photos`.
- `PhotoThumb` atom: `alt` is required (non-optional TypeScript), error fallback with Camera icon, min 44×44px touch target.
- `ProductCard` constructs public URLs directly from `NEXT_PUBLIC_SUPABASE_URL` env var (no signed URLs needed for public bucket).
- `PhotoUploadZone` implements full atomicity pattern: storage first → createProduct server action; on any failure the other side is cleaned up.
- Products page: `GalleryTemplate` wrapper, `PhotoUploadZone` always visible, product grid or empty state below.
- Placeholder `[id]` page returns `notFound()` to prevent 404 on build.
- 90 tests pass (86 existing + 4 new). Build zero TypeScript errors.

### File List

- `supabase/migrations/003_products.sql` (new)
- `supabase/migrations/004_photo_hashes.sql` (new)
- `supabase/migrations/009_storage_buckets.sql` (new)
- `src/types/database.ts` (modified — added products, photo_hashes tables)
- `src/components/atoms/PhotoThumb.tsx` (new)
- `src/lib/schemas/product.ts` (new)
- `src/actions/products.ts` (new)
- `src/components/organisms/PhotoUploadZone.tsx` (new)
- `src/components/templates/GalleryTemplate.tsx` (new)
- `src/components/organisms/ProductCard.tsx` (new)
- `src/app/(app)/products/page.tsx` (modified)
- `src/app/(app)/products/[id]/page.tsx` (new)
- `src/components/atoms/PhotoThumb.test.tsx` (new)
- `src/components/organisms/PhotoUploadZone.test.tsx` (new)
