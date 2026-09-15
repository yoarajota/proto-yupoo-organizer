-- 015_outreach_suggestions.sql
-- Outreach agent queue for structured, approval-gated suggestions (Wave 4)

CREATE TYPE outreach_suggestion_status AS ENUM (
  'pending_approval',
  'approved',
  'exported'
);

CREATE TABLE outreach_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES sourcing_missions(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES discovered_suppliers(id) ON DELETE CASCADE,
  channel_hint TEXT NOT NULL DEFAULT 'whatsapp',
  language TEXT NOT NULL DEFAULT 'en',
  message_text TEXT NOT NULL,
  status outreach_suggestion_status NOT NULL DEFAULT 'pending_approval',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  exported_at TIMESTAMPTZ,
  UNIQUE (mission_id, supplier_id)
);

CREATE INDEX outreach_suggestions_mission_id_idx ON outreach_suggestions(mission_id);
CREATE INDEX outreach_suggestions_supplier_id_idx ON outreach_suggestions(supplier_id);
CREATE INDEX outreach_suggestions_status_idx ON outreach_suggestions(status);

ALTER TABLE outreach_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read outreach suggestions"
  ON outreach_suggestions FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Auth users can insert outreach suggestions"
  ON outreach_suggestions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Auth users can update outreach suggestions"
  ON outreach_suggestions FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Auth users can delete outreach suggestions"
  ON outreach_suggestions FOR DELETE
  USING (auth.uid() IS NOT NULL);
