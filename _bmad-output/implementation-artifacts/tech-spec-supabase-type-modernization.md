---
title: "Supabase Type Modernization"
slug: "supabase-type-modernization"
created: "2026-03-27T11:39:15-03:00"
status: "ready-for-dev"
stepsCompleted: [1, 2, 3, 4]
tech_stack: ["Next.js 16", "Supabase", "TypeScript 5", "Tailwind CSS 4", "Zod"]
files_to_modify:
  [
    "src/types/database.ts",
    "src/actions/inquiries.ts",
    "src/components/organisms/InquirySheet.tsx",
    "src/app/(app)/active-inquiries/page.tsx",
    "src/app/(app)/suppliers/page.tsx",
    "src/app/(app)/products/[id]/page.tsx",
    "src/components/organisms/InquiryRow.tsx",
  ]
code_patterns:
  [
    "Supabase Typed Client (createServerClient)",
    "Next.js 16 Server Actions",
    "Shared Inquiry Types (InquiryWithSupplier)",
    "React Hook Form with Zod",
  ]
test_patterns: ["Vitest"]
---

# Tech-Spec: Supabase Type Modernization

**Created:** 2026-03-27T11:39:15-03:00

## Overview

### Problem Statement

The `src/types/database.ts` file is out of sync with the current database schema, missing tables such as `inquiries`. This forces the use of `(supabase as any)` castings in the codebase, which bypasses TypeScript's type safety and leads to fragile code.

### Solution

Regenerate the Supabase types in `src/types/database.ts` using the `supabase gen` command and then remove all `as any` castings throughout the codebase, replacing them with properly typed Supabase client calls.

### Scope

**In Scope:**

- Running `npm run db:types` (supabase gen types typescript --local) to update the primary type file.
- Identifying and removing `(supabase as any)` castings in all source files.
- Fixing any TypeScript errors that arise after removing the castings.
- Updating `src/types/database.ts`.

**Out of Scope:**

- Changes to the database schema itself.
- New features or UI changes.
- Refactoring business logic beyond what's required for typing.

## Context for Development

### Codebase Patterns

- **Supabase Action Pattern**: Uses `createServerClient<Database>` from `@/lib/supabase/server` to ensure responses are typed according to `src/types/database.ts`.
- **Relationship Typing**: The codebase relies on manual cast `as any` because joined fields like `suppliers(name)` or `products(notes)` are not currently being picked up by the stale `database.ts`.
- **Inquiry Data Pattern**: A shared interface `InquiryWithSupplier` is defined in `InquiryRow.tsx` and used by `InquiryTable.tsx`.

### Files to Reference

| File                                        | Purpose                                                                       |
| ------------------------------------------- | ----------------------------------------------------------------------------- |
| `src/types/database.ts`                     | The central Supabase types file (Target for generation).                      |
| `src/actions/inquiries.ts`                  | Server actions with intensive `as any` usage.                                 |
| `src/app/(app)/suppliers/page.tsx`          | Page calculating supplier stats using `as any` for `inquiries`.               |
| `src/components/organisms/InquirySheet.tsx` | Form using `any` in `useForm` and `onSubmit`.                                 |
| `src/components/organisms/InquiryRow.tsx`   | Defines `InquiryWithSupplier` which may need alignment after type generation. |

### Technical Decisions

- **Decision 1**: We will use `npm run db:types` which executes `supabase gen types typescript --local`.
- **Decision 2**: After generating types, we will leverage Supabase's generated `Inquiry` types instead of `any`.
- **Decision 3**: We will remove `// eslint-disable-next-line @typescript-eslint/no-explicit-any` comments along with the casts.

## Implementation Plan

### Tasks

- [ ] Task 1: Regenerate Supabase Types
  - File: `src/types/database.ts`
  - Action: Run `npm run db:types`.
  - Notes: Ensure the local Supabase container is running if using `--local`. If it fails, check if we need to use project-id for remote generation.

- [ ] Task 2: Remove Castings in Server Actions
  - File: `src/actions/inquiries.ts`
  - Action: Remove all `(supabase as any)` casts and let the `createServerClient<Database>` provide types.
  - Notes: Fix any resulting property access errors or returned data typing.

- [ ] Task 3: Update Shared Inquiry Interface
  - File: `src/components/organisms/InquiryRow.tsx`
  - Action: Update `InquiryWithSupplier` to use `Tables<'inquiries'>` and ensure the `suppliers` join is properly typed.
  - Notes: This interface is used by `InquiryTable` and `InquiryRow`.

- [ ] Task 4: Remove Castings in List Pages
  - Files: `src/app/(app)/suppliers/page.tsx`, `src/app/(app)/active-inquiries/page.tsx`, `src/app/(app)/products/[id]/page.tsx`
  - Action: Remove `(supabase as any)` and `as any` on result data.
  - Notes: Remove associated `eslint-disable` comments.

- [ ] Task 5: Remove Castings in Inquiry Form
  - File: `src/components/organisms/InquirySheet.tsx`
  - Action: Update `useForm<any>` to use `InquiryCreateValues` or the generated Supabase insert type. Remove `as any` from `onSubmit` and `SheetTrigger`.
  - Notes: Ensure `InquiryCreateSchema` remains aligned.

### Acceptance Criteria

- [ ] AC 1: Given a local Supabase environment, when `npm run db:types` is executed, then `src/types/database.ts` must contain the definitions for `inquiries` and all other active tables.
- [ ] AC 2: Given the codebase, when searched for `as any`, then no instances of `(supabase as any)` or `supabase as any` should remain in the `src` directory.
- [ ] AC 3: Given the TypeScript compiler, when `tsc --noEmit` is run, then no type errors should exist related to Supabase queries in the modified files.
- [ ] AC 4: Given the `InquirySheet` component, when submitting a valid inquiry, then the `createInquiry` action is called with properly typed arguments and no runtime errors occur.

## Additional Context

### Dependencies

- Supabase CLI (locally installed or available via npx)
- Local Supabase instance (if using `--local`)

### Testing Strategy

- **Static Analysis**: Run `tsc --noEmit` or `npm run lint` to ensure type safety.
- **Manual Verification**: Test adding/updating an inquiry via the UI to ensure no runtime regressions were introduced by type changes.
- **Unit Tests**: Run `npm run test` to ensure existing inquiries tests still pass.

### Notes

- **High-Risk**: If `supabase gen` produces slightly different relationship names (e.g., singular vs plural), we may need to update query strings like `.select('*, suppliers(name)')`.
- **Note**: This is primarily a maintenance/refactoring task to restore type safety.
