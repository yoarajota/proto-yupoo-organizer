-- 028_similarity_and_category_strategy.sql (Wave 3 portion: similarity ingest only)
-- D-04 option (a) WITHOUT OCR per D-12 similarity-only amendment: mission-scoped
-- photo_hashes rows for Yupoo image similarity ingest (download -> pHash ->
-- similarity_matches via the existing /api/phash route).
--
-- Supersede-only per D-05: existing preview_image_status 'fetched' semantics
-- (URL scraped, not bytes downloaded) are KEPT; the new download_status /
-- phash_status columns carry ground truth. No ocr_text, no OCR status.
-- MUST NOT touch brand_aliases (exists via 022_brand_aliases.sql).
-- Category-strategy DDL belongs to Wave 5 (T017) as a follow-up migration.

-- Machine-ingested rows have no product yet and no auth user (worker inserts
-- via service role, which bypasses RLS).
ALTER TABLE photo_hashes
  ALTER COLUMN product_id DROP NOT NULL,
  ALTER COLUMN created_by DROP NOT NULL;

ALTER TABLE photo_hashes
  ADD COLUMN mission_id uuid NULL REFERENCES sourcing_missions(id) ON DELETE CASCADE,
  ADD COLUMN download_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN phash_status text NOT NULL DEFAULT 'pending';

ALTER TABLE photo_hashes
  ADD CONSTRAINT photo_hashes_download_status_check
    CHECK (download_status IN ('pending', 'downloaded', 'failed')),
  ADD CONSTRAINT photo_hashes_phash_status_check
    CHECK (phash_status IN ('pending', 'hashed', 'failed'));

-- Ground truth for pre-existing upload rows: bytes were already in the bucket
-- at insert time; a persisted phash means the hash pipeline completed.
UPDATE photo_hashes SET download_status = 'downloaded';
UPDATE photo_hashes SET phash_status = 'hashed' WHERE phash IS NOT NULL;

CREATE INDEX IF NOT EXISTS photo_hashes_mission_id_idx ON photo_hashes(mission_id);
CREATE INDEX IF NOT EXISTS photo_hashes_phash_status_idx
  ON photo_hashes(phash_status) WHERE phash_status = 'pending';

-- Mission-scoped rows (product_id NULL, created_by NULL) stay readable to
-- authenticated users; worker inserts go through the service role.
CREATE POLICY "Auth users can read mission-scoped photo_hashes"
  ON photo_hashes FOR SELECT
  USING (mission_id IS NOT NULL AND auth.uid() IS NOT NULL);
