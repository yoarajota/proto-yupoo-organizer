# Story 6.2: Similarity Advisory Flag

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a group member,
I want to be alerted when newly uploaded photos match photos already in the library,
so that I can identify potential same-factory suppliers without manual visual inspection.

## Acceptance Criteria

1. **Given** a photo upload completes and pHash is computed, **When** a hash match above the similarity threshold (Hamming distance <= 10) is found in the group library, **Then** a `SimilarityAdvisoryBanner` is shown: "X photo(s) match products already in your library — [Supplier Name] uses similar images" (FR18, FR34, FR35).
2. **Given** the `SimilarityAdvisoryBanner`, **When** shown, **Then** it is dismissable; uses `role="alert"` for accessibility; no automatic record merging occurs.
3. **Given** a ProductCard with a confirmed pHash match, **When** shown in the gallery, **Then** a warning badge is visible on the card.
4. **Given** photos with no matches, **When** pHash check completes, **Then** no banner or indicator is shown — silent on no-match.

## Tasks / Subtasks

- [ ] **Database & Schema (AC: 1, 3)**
  - [ ] Create migration `008_similarity_matches.sql` for the `similarity_matches` table.
  - [ ] Columns: `id`, `source_photo_hash_id`, `matched_photo_hash_id`, `distance`, `is_dismissed`, `created_at`.
  - [ ] Implement RLS: Auth users can read; Creator can update (`is_dismissed`).
- [ ] **Backend: Similarity Matching Pipeline (AC: 1)**
  - [ ] Update `src/app/api/phash/route.ts` to compare the `computedHash` against existing `photo_hashes`.
  - [ ] Implement Hamming distance calculation for pHash (64-bit hex strings).
  - [ ] Threshold: Distance <= 10.
  - [ ] Store detected matches in the `similarity_matches` table.
- [ ] **Server Actions (AC: 2, 3)**
  - [ ] Add `getSimilarityMatches(productId: string)` to `src/actions/products.ts` to fetch undismissed matches for a product's photos.
  - [ ] Add `dismissSimilarityMatch(matchId: string)` to `src/actions/products.ts` to set `is_dismissed = true`.
- [ ] **UI Components (AC: 1, 2, 3)**
  - [ ] Create `src/components/molecules/SimilarityAdvisoryBanner.tsx` using the `Alert` component from shadcn/ui.
  - [ ] Update `src/components/organisms/ProductCard.tsx` to show a warning badge (Icon) if matches exist.
  - [ ] Integrate `SimilarityAdvisoryBanner` into `src/app/(app)/products/[id]/page.tsx`.
- [x] **Verification**
  - [ ] Verify similarity search correctly identifies matches within threshold.
  - [ ] Verify banner appears only when undismissed matches exist.
  - [ ] Verify badge appears on ProductCard in gallery.

## Dev Notes

- **Architecture Patterns**: Follow **Upload Atomicity (NFR9)** and **Snake Case** naming. The similarity check is async and non-blocking.
- **Source Tree Components**: `src/app/api/phash/route.ts`, `src/actions/products.ts`, `src/components/organisms/ProductCard.tsx`.
- **Testing Standards**: API must return `{ data, error }`. Similarity threshold of 10 is the starting point.

### Project Structure Notes

- **Alignment**: Use `src/components/molecules` for the banner and `src/components/organisms` for the cards.
- **Supabase**: Use the existing `createServerClient` for DB operations in the API and Actions.

### References

- [PRD]: Section "Photo Similarity Detection", FR18, FR34, FR35.
- [Architecture]: Section "API & Communication", "Implementation Patterns".
- [UX]: Section "Critical Success Moments", UX-DR8, UX-DR9.
- [Previous Story]: Story 6.1 (pHash computation pipeline) in `_bmad-output/implementation-artifacts/6-1-phash-computation-pipeline.md`.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
