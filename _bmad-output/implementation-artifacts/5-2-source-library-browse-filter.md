# Story 5.2: Source Library — Browse & Filter

Status: in-progress

## Story

As a group member,
I want to browse and filter saved sources by brand or platform,
so that I instantly find relevant research starting points.

## Acceptance Criteria

1. **Given** the Sources page, **When** it loads, **Then** all group sources are listed in a table showing: platform badge, URL (clickable link), brand tag chips, notes, an active toggle, and attribution (Added by [Role], [Date]).
2. **Given** brand or platform filter chips above the list, **When** I click one, **Then** the list filters immediately — no Apply button; active chip is filled, inactive is outlined (FR31).
3. **Given** the active toggle on a source row, **When** I toggle it off, **Then** `toggleSourceActive` marks the source inactive and it becomes visually muted (opacity-50) (FR32).
4. **Given** a filtered list that returns no matches, **When** rendered, **Then** "No results for [filter]" and a "Clear filters" link are shown.

## Tasks / Subtasks

- [ ] Implement Server-Side Logic (AC: 3)
  - [ ] Update `src/actions/sources.ts` with `toggleSourceActive` action.
  - [ ] Use `revalidatePath('/sources')` within the action.
- [ ] Build & Refactor UI Components (AC: 1, 2, 4)
  - [ ] Create `SourceRow` (organism) to handle row layout, toggle, and attribution.
  - [ ] Create `SourcesTable` (organism) to manage the table structure.
  - [ ] Create `SourcesFilter` (molecule) for platform and brand filter chips.
  - [ ] Refactor `src/app/(app)/sources/page.tsx` to use the new table and filter components.
- [ ] Implement Filtering & State (AC: 2, 4)
  - [ ] Add client-side filtering logic to the Sources page.
  - [ ] Implement "no results" empty state with "Clear filters" link.
- [ ] Verification
  - [ ] Update `src/actions/sources.test.ts` with tests for `toggleSourceActive`.
  - [ ] Run `npm test src/actions/sources.test.ts` to verify backend logic.

## Dev Notes

### Architecture Patterns & Constraints

- **Atomic Design**: Ensure `SourceRow` and `SourcesTable` are correctly placed in `src/components/organisms/`.
- **Attribution**: Use the `profiles` join pattern (`.select('*, profiles(role)')`) to show human-readable attribution ("Added by Member", etc.).
- **Optimistic UI**: Use `useTransition` for the `toggleSourceActive` action to ensure a responsive feel.
- **Visuals**: Inactive sources should be visually muted (e.g., `opacity-50`).

### Source Tree Components to Touch

- `src/actions/sources.ts` (new action)
- `src/app/(app)/sources/page.tsx` (major refactor)
- `src/components/organisms/` (new `SourceRow.tsx`, `SourcesTable.tsx`)
- `src/components/molecules/` (new `SourcesFilter.tsx`, `PlatformBadge.tsx`)

### Testing Standards

- All Server Actions must return `{ data, error }`.
- Verify toggling and filtering logic doesn't break existing `createSource` functionality.

### Project Structure Notes

- Next.js 16: Ensure `cookies()` is awaited in `createClient()`.
- Tailwind v4: All tokens must be referenced via `@theme` in `globals.css` (no arbitrary values).

## References

- [PRD]: FR31, FR32
- [Architecture]: Implementation Patterns (Server Actions, RLS)
- [UX]: List Patterns (DR20), Filter Patterns (DR13), Attribution (DR9)

## Dev Agent Record

### Agent Model Used

Antigravity (model-m47)

### Completion Notes

- Implemented `toggleSourceActive` server action in `src/actions/sources.ts`.
- Created `PlatformBadge` molecule with social media icons and brand colors.
- Created `SourcesFilter` molecule with interactive chips for platform and brand filtering.
- Created `SourceRow` organism with optimistic toggle logic and visual muting (opacity-50) for inactive sources.
- Created `SourcesTable` organism using Atomic Design patterns and Shadcn UI table.
- Refactored `src/app/(app)/sources/page.tsx` into a client component to handle real-time filtering and status toggling.
- Added unit tests for the new server action in `src/actions/sources.test.ts`.
- Verified all ACs:
  - AC1: Table shows platform, URL, brands, notes, toggle, and attribution.
  - AC2: Filter chips for platform and brand work instantaneously.
  - AC3: Toggle marks source inactive and mutes it visually.
  - AC4: Empty state shown for no results with "Clear filters" link.

### File List

- [MODIFY] [sources.ts](file:///home/jota_/projects/yoarajota/proto-yupoo-organizer/src/actions/sources.ts)
- [MODIFY] [sources.test.ts](file:///home/jota_/projects/yoarajota/proto-yupoo-organizer/src/actions/sources.test.ts)
- [MODIFY] [page.tsx](<file:///home/jota_/projects/yoarajota/proto-yupoo-organizer/src/app/(app)/sources/page.tsx>)
- [NEW] [PlatformBadge.tsx](file:///home/jota_/projects/yoarajota/proto-yupoo-organizer/src/components/molecules/PlatformBadge.tsx)
- [NEW] [SourcesFilter.tsx](file:///home/jota_/projects/yoarajota/proto-yupoo-organizer/src/components/molecules/SourcesFilter.tsx)
- [NEW] [SourceRow.tsx](file:///home/jota_/projects/yoarajota/proto-yupoo-organizer/src/components/organisms/SourceRow.tsx)
- [NEW] [SourcesTable.tsx](file:///home/jota_/projects/yoarajota/proto-yupoo-organizer/src/components/organisms/SourcesTable.tsx)

### Change Log

- 2026-03-29: Initial implementation of browse & filter features for Source Library.

Status: done
