# Repository Conventions

## Naming Conventions

### Files & Directories

- **Directories:** `kebab-case` (e.g., `src/app/(app)/suppliers`).
- **Components:** `PascalCase` (e.g., `SupplierRow.tsx`).
- **Server Actions:** `kebab-case` (e.g., `src/actions/suppliers.ts`).
- **Schemas:** `kebab-case` (e.g., `src/lib/schemas/supplier.ts`).
- **Utilities:** `kebab-case` (e.g., `src/lib/phash-utils.ts`).
- **Tests:** `[filename].test.ts[x]` (e.g., `InquiryRow.test.tsx`).

### Code Entities

- **Classes/Components:** `PascalCase`.
- **Functions/Variables:** `camelCase`.
- **Types/Interfaces:** `PascalCase`.

## Architectural Patterns

### Component Architecture

- **Structure:** Atomic Design (Atoms, Molecules, Organisms, Templates) located in `src/components`.
- **Next.js:** App Router with standardized `(app)` group for protected routes.
- **Directives:** Explicit use of `'use client'` and `'use server'`.

### Data & State

- **Database:** Supabase (PostgreSQL) managed via `supabase-js` and migrations.
- **Server Actions:** Primary method for data mutations, using `revalidatePath` for cache invalidation.
- **Validation:** Zod schemas in `src/lib/schemas` for form and API data.
- **Client State:** React `useState` for local UI state.

### Error Handling

- **Server Actions:** Return pattern `{ data, error: { message } | null }`.
- **Form Validation:** `schema.safeParse(formData)` with early returns on failure.

## Testing Standards

- **Framework:** Vitest + React Testing Library.
- **Environment:** `jsdom`.
- **Location:** Test files are adjacent to the implementation.
- **Mocks:** Standard Supabase client mocking (verified in test files).

## Git Workflow

- **Commit Style:** Conventional Commits (mostly `feat:`, `fix:`).
- **Messages:** Lowercase descriptions after the prefix.
- **History:** Shallow clone detected, but following a linear feature-based flow.
