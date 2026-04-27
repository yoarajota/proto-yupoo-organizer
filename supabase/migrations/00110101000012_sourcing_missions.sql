-- 012_sourcing_missions.sql
-- Mission scaffolding for autonomous sourcing workflow (Wave 1)

CREATE TYPE sourcing_mission_status AS ENUM (
  'created',
  'scanning',
  'matching',
  'suggestions_ready',
  'awaiting_approval',
  'approved_for_outreach',
  'replies_received',
  'offers_normalized',
  'completed',
  'blocked_needs_input',
  'failed_retrying',
  'failed_terminal'
);

CREATE TABLE sourcing_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_intent TEXT NOT NULL,
  objective TEXT NOT NULL DEFAULT 'speed',
  status sourcing_mission_status NOT NULL DEFAULT 'created',
  destination_context TEXT,
  constraints JSONB NOT NULL DEFAULT '{}'::jsonb,
  first_suggestion_batch_at TIMESTAMPTZ,
  first_valid_quote_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sourcing_mission_stage_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES sourcing_missions(id) ON DELETE CASCADE,
  stage_name TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  duration_ms INTEGER GENERATED ALWAYS AS (
    CASE
      WHEN finished_at IS NULL THEN NULL
      ELSE GREATEST(0, (EXTRACT(EPOCH FROM (finished_at - started_at)) * 1000)::INTEGER)
    END
  ) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (mission_id, stage_name, started_at)
);

CREATE INDEX sourcing_missions_created_by_idx ON sourcing_missions(created_by);
CREATE INDEX sourcing_missions_status_idx ON sourcing_missions(status);
CREATE INDEX sourcing_mission_stage_metrics_mission_id_idx ON sourcing_mission_stage_metrics(mission_id);
CREATE INDEX sourcing_mission_stage_metrics_stage_name_idx ON sourcing_mission_stage_metrics(stage_name);

ALTER TABLE sourcing_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sourcing_mission_stage_metrics ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER sourcing_missions_updated_at
  BEFORE UPDATE ON sourcing_missions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE POLICY "Auth users can read sourcing missions"
  ON sourcing_missions FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Auth users can insert sourcing missions"
  ON sourcing_missions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Creator or admin can update sourcing missions"
  ON sourcing_missions FOR UPDATE
  USING (created_by = auth.uid() OR is_admin());

CREATE POLICY "Creator or admin can delete sourcing missions"
  ON sourcing_missions FOR DELETE
  USING (created_by = auth.uid() OR is_admin());

CREATE POLICY "Auth users can read sourcing mission stage metrics"
  ON sourcing_mission_stage_metrics FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Auth users can insert sourcing mission stage metrics"
  ON sourcing_mission_stage_metrics FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Auth users can update sourcing mission stage metrics"
  ON sourcing_mission_stage_metrics FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Auth users can delete sourcing mission stage metrics"
  ON sourcing_mission_stage_metrics FOR DELETE
  USING (auth.uid() IS NOT NULL);
