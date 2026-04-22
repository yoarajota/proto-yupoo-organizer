# Module Analysis Registry

This file contains deep analysis reports for each module in the repository, generated during Step 4 of the repository onboarding process.

---

# Module: Core App

## Identity

- **Name:** Core App
- **Path:** `src/app`
- **Batch:** 1

---

## Entry Points & Public Interface

| Entry Point                        | Type        | Description                               |
| ---------------------------------- | ----------- | ----------------------------------------- |
| `src/app/layout.tsx`               | Root Layout | Global configuration (fonts, metadata).   |
| `src/app/(app)/layout.tsx`         | App Layout  | Authenticated shell, profile enforcement. |
| `src/app/(app)/products/page.tsx`  | Page        | Product gallery with similarity matching. |
| `src/app/(app)/suppliers/page.tsx` | Page        | Supplier directory and stats.             |

---

## Communication

### Exposes (outward)

- Web interface routes (Inquiries, Suppliers, Products, Sources, Settings).
- API routes (e.g., `/api/phash`).

### Consumes (inward)

- `src/components`: UI components (Templates, Organisms, Molecules, Atoms).
- `src/actions`: Server actions for data mutation (Users, Inquiries, Suppliers).
- `src/lib/supabase/server`: Database access.
- `src/types`: Centralized TypeScript definitions.

---

## Core Domain Logic

### Primary Entities

| Entity      | Location | Purpose                                             |
| ----------- | -------- | --------------------------------------------------- |
| `products`  | Database | Sourced product items with photo references.        |
| `suppliers` | Database | Sourced factory/wholesale contacts.                 |
| `inquiries` | Database | Product price/status inquiries linked to suppliers. |

### Key Behaviors & Algorithms

1. **Profile Enforcement**: `src/app/(app)/layout.tsx` calls `ensureProfile()` to guarantee every authenticated user has a corresponding row in the `profiles` table.
2. **Similarity Visualization**: `src/app/(app)/products/page.tsx` fetches `photo_hashes` and `similarity_matches` to display similarity warnings/badges on product cards.

### Request Lifecycle

1. **Entry**: User visits `/suppliers`.
2. **Data Layer**: `src/app/(app)/suppliers/page.tsx` performs parallel Supabase queries for suppliers, inquiries with prices, and active inquiries.
3. **Business Logic**: Computes `supplierStats` (price ranges, active inquiry counts).
4. **Response**: Renders `DetailTemplate` with `SupplierDirectory`.

---

## Notes & Gotchas

- Uses Next.js 15 App Router with nested layouts.
- Heavy reliance on Server Components for data fetching.
- Similarity matching logic is deeply integrated into the data fetching of the products page.

---

# Module: UI Library

## Identity

- **Name:** UI Library
- **Path:** `src/components`
- **Batch:** 1

---

## Entry Points & Public Interface

| Entry Point                                    | Type     | Description                                     |
| ---------------------------------------------- | -------- | ----------------------------------------------- |
| `src/components/templates/AppShell.tsx`        | Template | Primary layout wrapper with SideNav and TopBar. |
| `src/components/organisms/PhotoUploadZone.tsx` | Organism | Image upload area with drag & drop.             |
| `src/components/organisms/SupplierSheet.tsx`   | Organism | Side sheet for supplier details and creation.   |
| `src/components/organisms/ProductCard.tsx`     | Organism | Individual product item in the gallery.         |

---

## Communication

### Exposes (outward)

- Reusable React components (Atomic Design).
- Theme configuration via Tailwind CSS 4.

### Consumes (inward)

- `src/lib/utils`: `cn` helper for class merging.
- `src/actions`: Server actions for form submissions (`updateSupplier`, `createInquiry`).
- `lucide-react`: Icon set.
- `@base-ui/react`: Unstyled component primitives.

---

## Core Domain Logic

### Primary Entities

- Props usually map to database rows (e.g., `SupplierRow` from `src/types/database.ts`).

### Key Behaviors & Algorithms

1. **Atomic Design Architecture**: Components are strictly categorized into `atoms`, `molecules`, `organisms`, and `templates`.
2. **Trust Intelligence**: `TrustIntelligencePanel.tsx` manages supplier reputation, flagging, and price elasticity visualization.
3. **Form State Management**: Uses React's `useTransition` for non-blocking server action calls and `useState` for local form state.

---

## Notes & Gotchas

- Many components have detailed `.test.tsx` files.
- Uses `@base-ui/react` (Base UI) for accessible primitives.
- Design system uses CSS variables defined in `src/app/globals.css`.

---

# Module: Server Actions

## Identity

- **Name:** Server Actions
- **Path:** `src/actions`
- **Batch:** 2

---

## Entry Points & Public Interface

| Entry Point                | Type       | Description                                      |
| -------------------------- | ---------- | ------------------------------------------------ |
| `src/actions/inquiries.ts` | Action Set | CRM operations (create, update, delete, status). |
| `src/actions/products.ts`  | Action Set | Inventory and similarity management.             |
| `src/actions/suppliers.ts` | Action Set | Supplier directory management.                   |
| `src/actions/users.ts`     | Action Set | Profile and preference management.               |

---

## Communication

### Exposes (outward)

- Server-side functions for data mutation, accessible by Client Components.
- Path revalidation signals to Next.js.

### Consumes (inward)

- `src/lib/supabase/server`: Database client.
- `src/lib/schemas`: Zod validation schemas.
- `next/cache`: `revalidatePath` for UI updates.
- External API: `phash` compute trigger.

---

## Core Domain Logic

### Primary Entities

- Directly maps to database tables: `inquiries`, `products`, `suppliers`, `photo_hashes`, `profiles`.

### Key Behaviors & Algorithms

1. **Validation Pipeline**: Every action uses Zod `safeParse` before interacting with the database.
2. **Context-Aware Security**: Actions derive the current user via `auth.getUser()` to ensure RLS compliance.
3. **Optimistic Sync**: Heavy use of `revalidatePath` to ensure the server component tree reflects mutations immediately.
4. **Non-blocking Side Effects**: The pHash computation is triggered via a fire-and-forget `fetch` to a background API route.

### Request Lifecycle

1. **Entry**: Client Component calls `createInquiry(values)`.
2. **Validation**: Action validates `values` against `InquiryCreateSchema`.
3. **Supabase**: Action inserts record with `created_by = user.id`.
4. **Revalidation**: Action calls `revalidatePath('/workspace')`.
5. **Return**: Returns `{ data, error }` tuple.

---

## Notes & Gotchas

- Strict adherence to the `{ data, error }` pattern simplifies client-side error handling.
- Uses "use server" directive at the top of each file.
- Heavily tested with Vitest (unit style).

---

# Module: Database

## Identity

- **Name:** Database
- **Path:** `supabase`
- **Batch:** 2

---

## Entry Points & Public Interface

| Entry Point             | Type       | Description                          |
| ----------------------- | ---------- | ------------------------------------ |
| `supabase/migrations/*` | Migrations | SQL schema progression scripts.      |
| `supabase/config.toml`  | Config     | Local Supabase environment settings. |

---

## Communication

### Exposes (outward)

- Postgres Schema (public).
- Row Level Security (RLS) policies.
- Database triggers and functions (e.g., `update_updated_at`).

### Consumes (inward)

- Supabase Auth (for `auth.uid()` and `auth.users` references).

---

## Core Domain Logic

### Primary Entities

| Entity               | Description                                            |
| -------------------- | ------------------------------------------------------ |
| `profiles`           | User metadata and roles (`admin`, `user`).             |
| `suppliers`          | Contacts with `trust_score` and `categories`.          |
| `products`           | Item registry with `notes` and ownership.              |
| `photo_hashes`       | Storage paths and perceptual hashes for images.        |
| `inquiries`          | Multi-state procurement records (`sent` to `decided`). |
| `similarity_matches` | Hamming distance-based photo relationship mapping.     |

### Key Behaviors & Algorithms

1. **Identity-Based RLS**: Most policies check `created_by = auth.uid()` or `is_admin()`.
2. **Automated Auditing**: `updated_at` timestamps managed by Postgres triggers.
3. **Relational Integrity**: Deep cascading deletes (`on delete cascade`) across the hierarchy (Supplier -> Inquiry, Product -> Photo).
4. **Similarity Engine**: Uses `photo_hashes` and `similarity_matches` to enable visual duplicate detection.

---

## Notes & Gotchas

- Schema uses `timestamptz` for all time fields.
- RLS helpers are centralized in `002_rls_helpers.sql`.
- Migration numbering (`00110101...`) suggests a timestamped or sequential ID system (local dev convention).

---

# Module: Logic/Utils

## Identity

- **Name:** Logic/Utils
- **Path:** `src/lib`
- **Batch:** 3

---

## Entry Points & Public Interface

| Entry Point                   | Type       | Description                                        |
| ----------------------------- | ---------- | -------------------------------------------------- |
| `src/lib/supabase/server.ts`  | Factory    | SSR-compatible Supabase client creator.            |
| `src/lib/phash-utils.ts`      | Algorithm  | Hamming distance calculation for photo similarity. |
| `src/lib/schemas/*.ts`        | Schema Set | Zod validation rules for all domain models.        |
| `src/lib/supabase/storage.ts` | Helper     | Buffer-based image retrieval from Supabase.        |

---

## Communication

### Exposes (outward)

- Perceptual hash comparison logic (population count).
- Unified validation layer (Zod schemas).
- Type-safe database clients for Server, Client, and Admin contexts.

### Consumes (inward)

- `src/types/database`: Schema metadata for typed clients.
- `@supabase/ssr`: Client infrastructure.
- `zod`: Validation primitives.
- `sharp-phash` (implied): Remote trigger for hash generation.

---

## Core Domain Logic

### Primary Entities

- `SupabaseClient`: The primary data gateway.
- `ZodSchema`: Strict contracts for Inquiries, Products, and Suppliers.

### Key Behaviors & Algorithms

1. **Similarity popcount**: `calculateHammingDistance` implements a manual bitwise population count (popcount) to determine visual difference between images.
2. **Context-Fluid Auth**: Handles cookie synchronization between Next.js and Supabase across both Client and Server boundaries.
3. **Schema-First Integrity**: Ensures all mutations (via Actions) are validated before reaching the database, reducing RLS policy failures.

---

## Notes & Gotchas

- Perceptual hashing assumes 64-bit hex strings.
- Storage helpers convert Blobs to Buffers for server-side processing Compatibility.
- Heavily utilize TypeScript's `z.infer` to keep types in sync with validation.

---

# Module: Types

## Identity

- **Name:** Types
- **Path:** `src/types`
- **Batch:** 3

---

## Entry Points & Public Interface

| Entry Point             | Type       | Description                                  |
| ----------------------- | ---------- | -------------------------------------------- |
| `src/types/database.ts` | Definition | Generated Supabase schema and utility types. |

---

## Communication

### Exposes (outward)

- Global `Database` object type.
- Helper types for CRUD operations (`Tables`, `Insert`, `Update`).
- Enum definitions matching Postgres constraints.

### Consumes (inward)

- None (Independent).

---

## Core Domain Logic

### Primary Entities

- Directly reflects the database schema: `profiles`, `suppliers`, `products`, `inquiries`, `photo_hashes`, `similarity_matches`.

### Key Behaviors & Algorithms

1. **Type-Safety Foundation**: Provides the backbone for the entire application's data layer, enabling autocomplete and compile-time error checking for all DB operations.
2. **Schema Mirroring**: Acts as a mirror of the Supabase SQL state, ensuring that application code cannot deviate from database constraints.

---

## Next Steps

- This file is usually auto-generated and should not be modified manually.
- Significant changes to the database schema require a re-generation of this file.
