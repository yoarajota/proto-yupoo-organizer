# Story 4.5: supplier-detail-linked-inquiry-history

Status: review

## Story

As a group member,
I want to see all inquiries linked to a supplier on the supplier's detail page,
so that I can review everything my group has negotiated with this supplier in one place.

## Acceptance Criteria

1. **Given** the Supplier Detail page, **When** it loads, **Then** a "Linked Inquiries" section shows all inquiries for this supplier across all products and group members — with `PhotoThumb`, product info, status badge, price, and `AttributionLine` (FR24).
2. **Given** no inquiries for this supplier, **When** the section renders, **Then** "No inquiries logged for this supplier yet." is shown.

## Tasks / Subtasks

- [x] Create `getInquiriesBySupplier` Server Action (AC: 1)
  - [x] Add function to `src/actions/inquiries.ts`
  - [x] Include join with `products` and `photo_hashes`
- [x] Update Supplier Detail Page (AC: 1, 2)
  - [x] Add "Linked Inquiries" section to `src/app/(app)/suppliers/[id]/page.tsx`
  - [x] Use `InquiryTable` with `showProductName={true}`
- [x] Verify functionality (AC: 1, 2)
  - [x] Add unit tests for the new server action
  - [x] Manually verify empty and populated states

## Developer Context

This story completes the cross-linking of inquiries in Epic 4. While Story 4.4 focused on product-centric inquiry history, 4.5 focuses on supplier-centric history.

### Technical Requirements

- All data fetching must happen in Server Components using the Supabase server client.
- Server Actions must return `{ data, error }` shape.
- Use `revalidatePath` to ensure data freshness when mutations occurs in other parts of the app.

### Architecture Compliance

- Follow Atomic Design: `InquiryTable` and `InquiryRow` are organisms; `PhotoThumb` and `AttributionLine` are atoms.
- Naming: use `snake_case` for DB and files in `src/actions/`.
- RLS: Ensure queries are compatible with `auth.uid() IS NOT NULL` policies.

### File Structure Requirements

- `src/app/(app)/suppliers/[id]/page.tsx` (Modified)
- `src/actions/inquiries.ts` (Modified)
- `src/actions/inquiries.test.ts` (Modified)

### Previous Story Intelligence

- **4-4-product-detail-market-overview-full-inquiry-history**: Utilized `InquiryTable` and `InquiryRow`. `InquiryRow` already supports `showProductName={true}` and fetches `products.photo_hashes` for thumbnails. Ensure this pattern is maintained.
- **4-3-inquiry-status-price-management**: Refined `InquiryRow` with `EditablePrice` and `EditableNotes`. Supplier detail page should display these to allow quick edits.

## Project Context Reference

- **PRD**: FR24 ("Members can view all inquiries for a supplier across all products").
- **UX**: UX-DR10 (Supplier Detail Panel), UX-DR20 (InquiryTable).
- **Architecture**: Core implementation patterns (Server Actions, Atomic Design).

## Dev Agent Record

### Agent Model Used

Antigravity (model-m47)

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Implemented `getInquiriesBySupplier` with profiles join for better attribution.
- Updated `InquiryRow` to show human-readable roles (e.g., "Team admin") instead of UUIDs.
- Verified Linked Inquiries section on Supplier Detail page.
- 114/114 tests passed, including new inquiry action tests.

### File List

- \_bmad-output/implementation-artifacts/4-5-supplier-detail-linked-inquiry-history.md (new)
