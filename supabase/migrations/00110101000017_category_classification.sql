-- 017_category_classification.sql
-- Mission-scoped category normalization and review workflow for Yupoo discovery

ALTER TYPE sourcing_mission_status ADD VALUE IF NOT EXISTS 'classifying_categories' AFTER 'scanning';

ALTER TABLE discovered_categories
  ADD COLUMN raw_label TEXT NOT NULL DEFAULT '',
  ADD COLUMN normalized_label TEXT,
  ADD COLUMN brand_signal TEXT,
  ADD COLUMN product_signal TEXT,
  ADD COLUMN classification_status TEXT NOT NULL DEFAULT 'needs_review',
  ADD COLUMN classification_confidence NUMERIC(5,4),
  ADD COLUMN classification_method TEXT;

UPDATE discovered_categories
SET raw_label = COALESCE(
  NULLIF(category_path[array_length(category_path, 1)], ''),
  array_to_string(category_path, ' ')
)
WHERE raw_label = '';

ALTER TABLE discovered_categories
  ADD CONSTRAINT discovered_categories_classification_status_check
    CHECK (classification_status IN ('auto_accepted', 'needs_review', 'reviewed')),
  ADD CONSTRAINT discovered_categories_classification_method_check
    CHECK (
      classification_method IS NULL
      OR classification_method IN ('rules', 'embedding', 'manual')
    );

ALTER TABLE discovered_suppliers
  ADD COLUMN normalized_category_refs TEXT[] NOT NULL DEFAULT '{}';

CREATE TABLE mission_category_classifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES sourcing_missions(id) ON DELETE CASCADE,
  source_category_id UUID NOT NULL REFERENCES discovered_categories(id) ON DELETE CASCADE,
  canonical_brand TEXT,
  canonical_product_type TEXT,
  display_label TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  classification_status TEXT NOT NULL,
  classification_confidence NUMERIC(5,4),
  classification_method TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (mission_id, source_category_id),
  CONSTRAINT mission_category_classifications_status_check
    CHECK (classification_status IN ('auto_accepted', 'needs_review', 'reviewed')),
  CONSTRAINT mission_category_classifications_method_check
    CHECK (classification_method IN ('rules', 'embedding', 'manual'))
);

CREATE INDEX mission_category_classifications_mission_id_idx
  ON mission_category_classifications(mission_id);

CREATE INDEX mission_category_classifications_source_category_id_idx
  ON mission_category_classifications(source_category_id);

ALTER TABLE mission_category_classifications ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER mission_category_classifications_updated_at
  BEFORE UPDATE ON mission_category_classifications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE POLICY "Auth users can read mission category classifications"
  ON mission_category_classifications FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Auth users can insert mission category classifications"
  ON mission_category_classifications FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Auth users can update mission category classifications"
  ON mission_category_classifications FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Auth users can delete mission category classifications"
  ON mission_category_classifications FOR DELETE
  USING (auth.uid() IS NOT NULL);
