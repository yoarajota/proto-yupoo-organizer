-- 016_inbound_offers_and_catalogue.sql
-- Inbound parsing persistence for offers and catalogue summaries (Wave 5)

CREATE TYPE supplier_message_direction AS ENUM (
  'outbound',
  'inbound'
);

CREATE TABLE supplier_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES sourcing_missions(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES discovered_suppliers(id) ON DELETE CASCADE,
  direction supplier_message_direction NOT NULL,
  channel TEXT NOT NULL,
  body TEXT NOT NULL,
  received_or_sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE normalized_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES sourcing_missions(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES discovered_suppliers(id) ON DELETE CASCADE,
  unit_price NUMERIC(12,4),
  currency TEXT,
  moq INTEGER,
  lead_time TEXT,
  terms_notes TEXT,
  extraction_confidence NUMERIC(5,4) NOT NULL,
  extracted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (mission_id, supplier_id)
);

CREATE TABLE catalogue_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES sourcing_missions(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES discovered_suppliers(id) ON DELETE CASCADE,
  catalogue_requested_at TIMESTAMPTZ,
  catalogue_received_at TIMESTAMPTZ,
  summary_text TEXT NOT NULL,
  summary_confidence NUMERIC(5,4) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (mission_id, supplier_id)
);

CREATE INDEX supplier_messages_mission_id_idx ON supplier_messages(mission_id);
CREATE INDEX supplier_messages_supplier_id_idx ON supplier_messages(supplier_id);
CREATE INDEX supplier_messages_direction_idx ON supplier_messages(direction);
CREATE INDEX normalized_offers_mission_id_idx ON normalized_offers(mission_id);
CREATE INDEX normalized_offers_supplier_id_idx ON normalized_offers(supplier_id);
CREATE INDEX catalogue_summaries_mission_id_idx ON catalogue_summaries(mission_id);
CREATE INDEX catalogue_summaries_supplier_id_idx ON catalogue_summaries(supplier_id);

ALTER TABLE supplier_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE normalized_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalogue_summaries ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER normalized_offers_updated_at
  BEFORE UPDATE ON normalized_offers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER catalogue_summaries_updated_at
  BEFORE UPDATE ON catalogue_summaries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE POLICY "Auth users can read supplier messages"
  ON supplier_messages FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Auth users can insert supplier messages"
  ON supplier_messages FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Auth users can update supplier messages"
  ON supplier_messages FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Auth users can delete supplier messages"
  ON supplier_messages FOR DELETE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Auth users can read normalized offers"
  ON normalized_offers FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Auth users can insert normalized offers"
  ON normalized_offers FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Auth users can update normalized offers"
  ON normalized_offers FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Auth users can delete normalized offers"
  ON normalized_offers FOR DELETE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Auth users can read catalogue summaries"
  ON catalogue_summaries FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Auth users can insert catalogue summaries"
  ON catalogue_summaries FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Auth users can update catalogue summaries"
  ON catalogue_summaries FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Auth users can delete catalogue summaries"
  ON catalogue_summaries FOR DELETE
  USING (auth.uid() IS NOT NULL);
