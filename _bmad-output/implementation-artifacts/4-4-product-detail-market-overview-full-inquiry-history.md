# Story 4.4: product-detail-market-overview-full-inquiry-history

Status: ready-for-dev

## Story

As a group member,
I want to see all inquiries for a product with a price range summary in a single view,
So that I recover full negotiation context in under 10 seconds after a supplier reply.

## Acceptance Criteria

1. **Given** the Product Detail page, **When** it loads, **Then** it shows: `ProductPhotoStrip` at top -> `MarketOverviewCallout` -> `InquiryTable` listing all inquiries for this product across all suppliers and group members — no sub-navigation required.
2. **Given** the `MarketOverviewCallout`, **When** price data exists, **Then** it displays "X quotes: R$Y–R$Z" with a count of Decided vs. Negotiating inquiries; `role="region"` ARIA is set.
3. **Given** the inquiry table on product detail, **When** rendered, **Then** each row shows: supplier name, status badge, price, `AttributionLine` (who logged, when) — attribution present on every row.
4. **Given** a product with no inquiries, **When** the detail page loads, **Then** "No inquiries yet — add one" with a `Button` is shown.

## Developer Context

This story focuses on assembling the `Product Detail` page by combining the `ProductPhotoStrip` (from Epic 3) with the newly created `InquiryTable` and `MarketOverviewCallout`.

### Technical Requirements

- Utilize existing Server Actions to fetch Product + its inquiries.
- `MarketOverviewCallout` must derive the min/max prices and count the Decided/Negotiating quotes from the fetched data.
- Integrate the `InquiryTable` to list all inquiries for the specific product.

### Architecture Compliance

- Follow the `DetailTemplate` structure for the layout.
- Maintain `camelCase` for actions. Return `{ data, error }`.
- Use `role="region"` for `MarketOverviewCallout`.

### Library / Framework Requirements

- Tailwind CSS design system tokens. Need to use semantic colors.

### File Structure Requirements

- `src/app/(app)/products/[id]/page.tsx`
- `src/components/molecules/MarketOverviewCallout.tsx`
- `src/components/organisms/InquiryTable.tsx`
- `src/components/atoms/AttributionLine.tsx`

### Previous Story Intelligence

- **4-3-inquiry-status-price-management**: Dev successfully implemented `StatusDropdown`, `EditablePrice`, and `EditableNotes`. Ensure these are used within the `InquiryTable` rows if editing is allowed here, otherwise use the unified `InquiryRow`. `InquiryRow` got modified in 4-3, so rely on it.

## Project Context Reference

- **PRD**: FR23, FR26, FR27.
- **UX**: UX-DR7, UX-DR9, UX-DR20.

## Completion Status

- **Status**: review
- **Completion Note**: MarketOverviewCallout implemented and integrated into Product Detail page. Unit tests passed.

## Dev Agent Record

### Agent Model Used

Antigravity (model-m47)

### Completion Notes List

- ✅ Created `MarketOverviewCallout` molecule with BRL price range and status counts.
- ✅ Added Vitest unit tests for `MarketOverviewCallout` (5/5 passing).
- ✅ Integrated `MarketOverviewCallout` into `src/app/(app)/products/[id]/page.tsx`.
- ✅ Refined `InquiryTable` empty state to match PRD.

### File List

- src/components/molecules/MarketOverviewCallout.tsx (new)
- src/components/molecules/MarketOverviewCallout.test.tsx (new)
- src/app/(app)/products/[id]/page.tsx (modified)
- src/components/organisms/InquiryTable.tsx (modified)
