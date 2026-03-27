# Story 4.1: create-inquiry-linking-product-to-supplier

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a group member,
I want to create an inquiry that links a product to a supplier with a starting status,
so that I can track which suppliers I've contacted for a product.

## Acceptance Criteria

1. **Given** the Product Detail page, **When** I click "Add Inquiry", **Then** a Sheet opens with: supplier dropdown (all group suppliers), status defaulting to "Sent", optional price, optional notes.
2. **Given** the form, **When** I select a supplier and submit, **Then** `createInquiry` creates the record; it appears in the product's inquiry table and the active inquiries list.
3. **Given** the `inquiries` migration and `rls_policies` migration, **When** they run, **Then** the `inquiries` table has: `id`, `product_id`, `supplier_id`, `status` (enum: sent/price_received/negotiating/decided/ghosted), `price`, `notes`, `created_by`, `created_at`, `updated_at`; RLS policies grant auth-gated SELECT/INSERT and creator-or-admin UPDATE/DELETE to all tables.

## Tasks / Subtasks

- [x] Database Migration (AC: 3)
  - [x] Create `supabase/migrations/005_inquiries.sql` with table, enum, and RLS policies.
- [x] Backend Implementation (AC: 2, 3)
  - [x] Create `src/lib/schemas/inquiry.ts` using Zod.
  - [x] Create `src/actions/inquiries.ts` with `createInquiry` server action.
  - [x] Create `src/actions/inquiries.test.ts` for unit testing.
- [x] UI Component Development (AC: 1, 2)
  - [x] Create `src/components/atoms/AttributionLine.tsx`.
  - [x] Create `src/components/molecules/StatusDropdown.tsx`.
  - [x] Create `src/components/organisms/InquiryRow.tsx` and `InquiryTable.tsx`.
  - [x] Create `src/components/organisms/InquirySheet.tsx` (Form).
- [x] Page Integration (AC: 1, 2)
  - [x] Update `src/app/(app)/products/[id]/page.tsx` to include "Add Inquiry" and `InquiryTable`.
  - [x] Update `src/app/(app)/active-inquiries/page.tsx` with `InquiryTable`.

## Dev Notes

- **Tech Stack**: Next.js 16 (App Router), Supabase (@supabase/ssr), Tailwind CSS v4, shadcn/ui.
- **Pattern**: Server Action return shape `{ data, error }`.
- **Naming**: `snake_case` for DB and action files; `PascalCase` for components.
- **Atomic Design**: Strictly follow `src/components/{atoms|molecules|organisms|templates}` structure.
- **Async Cookies**: Remember `await cookies()` in `src/lib/supabase/server.ts`.
- **Tailwind v4**: Tokens live in `src/app/globals.css` via `@theme`.

### Project Structure Notes

- Files to create:
  - `supabase/migrations/005_inquiries.sql`
  - `src/lib/schemas/inquiry.ts`
  - `src/actions/inquiries.ts`
  - `src/actions/inquiries.test.ts`
  - `src/components/atoms/AttributionLine.tsx`
  - `src/components/molecules/StatusDropdown.tsx`
  - `src/components/organisms/InquiryRow.tsx`
  - `src/components/organisms/InquiryTable.tsx`
  - `src/components/organisms/InquirySheet.tsx`
- Files to modify:
  - `src/app/(app)/products/[id]/page.tsx`
  - `src/app/(app)/active-inquiries/page.tsx`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.1]
- [Source: _bmad-output/planning-artifacts/architecture.md]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md]

## Dev Agent Record

### Agent Model Used

Antigravity (GPT-4o)

### Debug Log References

- Next.js 16 async params: used `const { id } = await params` in Product Detail page.
- TypeScript Casting: Casted `supabase` client as `any` because the `inquiries` table is not yet in the auto-generated `Database` types (local dev environment constraints).
- shadcn Component Addition: Added `select`, `dropdown-menu`, and `table` via `npx shadcn@latest add`.
- SheetTrigger API: Used `render` instead of `asChild` for `SheetTrigger` based on `@base-ui/react/dialog` implementation in this project.
- revalidatePath: Re-validates `/active-inquiries` and `/products/[id]` on inquiry changes.

### Completion Notes List

- All tasks and ACs satisfied.
- Full "Vertical Slice" implemented: Migration → Schema → Action → Components → Pages.
- Responsive table display for inquiries on both Product Detail and Active Inquiries list.
- Real-time status updates from the inquiry list (inline editing).

### File List

- `supabase/migrations/005_inquiries.sql`
- `src/lib/schemas/inquiry.ts`
- `src/actions/inquiries.ts`
- `src/actions/inquiries.test.ts`
- `src/components/atoms/AttributionLine.tsx`
- `src/components/molecules/StatusDropdown.tsx`
- `src/components/organisms/InquiryRow.tsx`
- `src/components/organisms/InquiryTable.tsx`
- `src/components/organisms/InquirySheet.tsx`
- `src/app/(app)/products/[id]/page.tsx` (modified)
- `src/app/(app)/active-inquiries/page.tsx` (modified)
- `src/components/ui/select.tsx` (new)
- `src/components/ui/dropdown-menu.tsx` (new)
- `src/components/ui/table.tsx` (new)

## Change Log

- 2026-03-27: Story 4.1 implemented — Inquiry system complete with database schema, server actions, and UI integration. Ready for review.
