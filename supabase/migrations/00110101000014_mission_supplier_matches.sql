-- 014_mission_supplier_matches.sql
-- Match agent persistence for ranked supplier shortlists (Wave 3)

CREATE TABLE mission_supplier_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES sourcing_missions(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES discovered_suppliers(id) ON DELETE CASCADE,
  rank_score NUMERIC(8,4) NOT NULL,
  rank_reasons JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (mission_id, supplier_id)
);

CREATE INDEX mission_supplier_matches_mission_id_idx ON mission_supplier_matches(mission_id);
CREATE INDEX mission_supplier_matches_supplier_id_idx ON mission_supplier_matches(supplier_id);
CREATE INDEX mission_supplier_matches_rank_score_idx ON mission_supplier_matches(rank_score DESC);

ALTER TABLE mission_supplier_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read mission supplier matches"
  ON mission_supplier_matches FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Auth users can insert mission supplier matches"
  ON mission_supplier_matches FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Auth users can update mission supplier matches"
  ON mission_supplier_matches FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Auth users can delete mission supplier matches"
  ON mission_supplier_matches FOR DELETE
  USING (auth.uid() IS NOT NULL);
