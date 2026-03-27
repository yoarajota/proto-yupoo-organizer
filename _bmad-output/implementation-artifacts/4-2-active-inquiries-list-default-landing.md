# Story 4.2: active-inquiries-list-default-landing

Status: review

## Story

As a group member,
I want to land on a list of all active group inquiries when I open the app,
so that I can quickly locate an inquiry to follow up on after a supplier reply.

## Acceptance Criteria

1. **Given** I log in, **When** I land on `/active-inquiries`, **Then** all inquiries with status `Sent`, `Price Received`, or `Negotiating` are displayed in `InquiryTable`.
2. **Given** an inquiry row, **When** it loads, **Then** it shows: `PhotoThumb` (first product photo), product info (notes preview), supplier name, status badge, price, and `AttributionLine`.
3. **Given** the page is loading, **When** data has not yet arrived, **Then** `Skeleton` rows at the same height as real rows appear (via a new `loading.tsx` for the route).
4. **Given** no active inquiries, **When** the page loads, **Then** "No active inquiries yet — add your first inquiry from a product page." is shown.
5. **Given** an inquiry row, **When** I click it, **Then** I navigate to the associated Product Detail page.

## Tasks / Subtasks

- [x] Route Environment (AC: 1, 3)
  - [x] Implement `src/app/(app)/active-inquiries/loading.tsx` using `Skeleton` rows.
  - [x] Ensure login redirect points to `/active-inquiries` (check `(auth)/login/page.tsx` or `middleware.ts`).
- [x] InquiryRow UI Enhancement (AC: 2, 5)
  - [x] Update `InquiryRow.tsx` to include `PhotoThumb` at the beginning of the row.
  - [x] Update `InquiryRow.tsx` and `InquiryTable.tsx` to support clicking the row to navigate to `/products/[id]`.
- [x] Data Integration (AC: 2, 4)
  - [x] Update query in `src/app/(app)/active-inquiries/page.tsx` to include `photo_hashes(storage_path)` via product join.
  - [x] Refine empty state message in `InquiryTable.tsx` to match the AC specifically for the active list.
- [x] Accessibility (AC: 2)
  - [x] Ensure `PhotoThumb` has proper `alt` text in the row.
  - [x] Ensure row links are keyboard accessible.

## Dev Notes

- **PhotoThumb**: Use `photo_hashes[0].storage_path` from the product join.
- **Skeleton**: Should match the height of `h-[72px]` used in `InquiryRow`.
- **Navigation**: Use `useRouter` or wrap the row in a Link if possible (though `TableRow` as a link requires care with nested links like `SupplierLink`).
- **Atomic Design**: Keep `InquiryRow` and `InquiryTable` in `organisms/`.
- **Async Cookies**: Use `await createClient()` which correctly handles async cookies in this project.

## Dev Agent Record

### Agent Model Used

Antigravity (GPT-4o)

### Implementation Plan

1. Created `Skeleton` UI component for loading states.
2. Implemented `loading.tsx` for `/active-inquiries` route with table row skeletons.
3. Enhanced `InquiryRow` with `PhotoThumb` and row-level navigation.
4. Updated Supabase query to join with product photos.
5. Improved empty state message to match requirements.
6. Ensured accessibility by adding labels and making interactive elements reachable via keyboard.

### Completion Notes

- Implementation completed following Story 4.2 requirements.
- All Acceptance Criteria verified.
- Redirection from root and login to `/active-inquiries` confirmed.
- Verified linting in components.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.2]
- [Source: _bmad-output/planning-artifacts/architecture.md]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md]
- [Context: _bmad-output/implementation-artifacts/4-1-create-inquiry-linking-product-to-supplier.md]

## Change Log

- 2026-03-27: Story 4.2 created — Refining the active inquiries list as the primary app landing.
