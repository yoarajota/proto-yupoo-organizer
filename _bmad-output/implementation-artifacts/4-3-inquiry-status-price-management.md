# Story 4.3: inquiry-status-price-management

Status: ready-for-dev

## Story

As a group member,
I want to update an inquiry's negotiation status and log a received price deliberately,
so that my negotiation state is accurately tracked and visible to the group.

## Acceptance Criteria

1. **Given** a `StatusDropdown` on any inquiry row, **When** I click the status badge, **Then** a dropdown opens with valid next statuses; the badge updates optimistically before API confirmation.
2. **Given** an optimistic status update, **When** the API call fails, **Then** the badge reverts to the previous status and an inline error message is shown.
3. **Given** the status badge system, **When** rendered for each status, **Then** colors match the spec: Sent = zinc-100/zinc-600, Price Received = blue-50/blue-700, Negotiating = amber-50/amber-700, Decided = green-50/green-700, Ghosted = zinc-50/zinc-400.
4. **Given** a price field on an inquiry, **When** I enter a value and save, **Then** `updateInquiryPrice` persists the price; it feeds the group's price history.
5. **Given** a notes field, **When** I edit and save, **Then** `updateInquiryNotes` persists the note.
6. **Given** a screen reader, **When** a status changes, **Then** an `aria-live="polite"` announcement of the new status is made.

## Tasks / Subtasks

- [x] StatusDropdown Component (AC: 1, 2, 3, 6)
  - [x] Implement `StatusDropdown` molecule (Badge + DropdownMenu) with Radix UI.
  - [x] Use `useTransition` or optimistic state for immediate visual update.
  - [x] Support color system tokens for each status variant.
  - [x] Implement error handling and state reversion on API failure.
  - [x] Add `aria-live="polite"` region for accessibility announcements and ensure arrow key navigation works.
- [x] Price & Notes Update Integration (AC: 4, 5)
  - [x] Implement Server Actions `updateInquiryStatus`, `updateInquiryPrice`, and `updateInquiryNotes` in `src/app/actions/inquiries.ts`.
  - [x] Connect Price field in UI to its Server Action.
  - [x] Connect Notes field in UI to its Server Action.
- [x] Integration into Rows/Detail
  - [x] Render `StatusDropdown` and price field where specified in UX design (e.g. `InquiryMeta` or `InquiryRow`).

## Dev Notes

- **Optimistic Updates**: Badge changes before API confirms. Ensure row is not disabled during this transition, an inline spinner can be shown on the dropdown/badge.
- **Server Actions**: `camelCase` verb-noun pattern. Return `{ data, error }`. Do not throw exceptions.
- **Accessibility**: Use Radix primitives where appropriate. Screen readers must hear status changes (`aria-live="polite"`).
- **Design Tokens**: Make sure to use existing tailwind token groups.

### Project Structure Notes

- Alignment with unified project structure: `StatusDropdown` component should be a molecule according to Atomic Design.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.3]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md]
- [Source: _bmad-output/planning-artifacts/architecture.md]
- [Context: _bmad-output/implementation-artifacts/4-2-active-inquiries-list-default-landing.md]

## Dev Agent Record

### Agent Model Used

Antigravity

### Debug Log References

- Addressed AC3 color styles correctly in `StatusDropdown`. Added aria-live for accessibility.
- Implemented `EditablePrice` and `EditableNotes` molecules.
- Created wrapper actions for `updateInquiryStatus`, `updateInquiryPrice`, `updateInquiryNotes` in `actions/inquiries.ts`.

### Completion Notes List

- ✅ Implemented StatusDropdown with optimistic validation and error reversion.
- ✅ Implemented EditablePrice and EditableNotes inline fields.
- ✅ Integrated into InquiryRow with proper stopPropagation and API connection.
- status updated to 'review'

### File List

- src/components/molecules/StatusDropdown.tsx (modified)
- src/actions/inquiries.ts (modified)
- src/components/organisms/InquiryRow.tsx (modified)
- src/components/molecules/EditablePrice.tsx (new)
- src/components/molecules/EditableNotes.tsx (new)
