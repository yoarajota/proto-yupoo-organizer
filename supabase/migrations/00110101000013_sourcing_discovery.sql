-- 013_sourcing_discovery.sql
-- Scout agent persistence for discovered Yupoo categories and suppliers (Wave 2)

CREATE TABLE discovered_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES sourcing_missions(id) ON DELETE CASCADE,
  source_url TEXT NOT NULL,
  category_path TEXT[] NOT NULL,
  extracted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confidence NUMERIC(5,4) NOT NULL DEFAULT 0.7000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (mission_id, source_url, category_path)
);

CREATE TABLE discovered_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES sourcing_missions(id) ON DELETE CASCADE,
  supplier_key TEXT NOT NULL,
  source_url TEXT NOT NULL,
  category_refs TEXT[] NOT NULL DEFAULT '{}',
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confidence NUMERIC(5,4) NOT NULL DEFAULT 0.6500,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (mission_id, supplier_key, source_url)
);

CREATE INDEX discovered_categories_mission_id_idx ON discovered_categories(mission_id);
CREATE INDEX discovered_categories_extracted_at_idx ON discovered_categories(extracted_at DESC);
CREATE INDEX discovered_suppliers_mission_id_idx ON discovered_suppliers(mission_id);
CREATE INDEX discovered_suppliers_supplier_key_idx ON discovered_suppliers(supplier_key);

ALTER TABLE discovered_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE discovered_suppliers ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER discovered_suppliers_updated_at
  BEFORE UPDATE ON discovered_suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE POLICY "Auth users can read discovered categories"
  ON discovered_categories FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Auth users can insert discovered categories"
  ON discovered_categories FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Auth users can update discovered categories"
  ON discovered_categories FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Auth users can delete discovered categories"
  ON discovered_categories FOR DELETE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Auth users can read discovered suppliers"
  ON discovered_suppliers FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Auth users can insert discovered suppliers"
  ON discovered_suppliers FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Auth users can update discovered suppliers"
  ON discovered_suppliers FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Auth users can delete discovered suppliers"
  ON discovered_suppliers FOR DELETE
  USING (auth.uid() IS NOT NULL);
