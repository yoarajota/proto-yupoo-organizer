-- 025_mission_queue_hardening.sql
-- Durable queue-backed mission execution and database-readable run diagnostics.

ALTER TYPE sourcing_mission_status ADD VALUE IF NOT EXISTS 'discovery_queued';
ALTER TYPE sourcing_mission_status ADD VALUE IF NOT EXISTS 'classification_queued';
ALTER TYPE sourcing_mission_status ADD VALUE IF NOT EXISTS 'matching_queued';
ALTER TYPE sourcing_mission_status ADD VALUE IF NOT EXISTS 'outreach_queued';
ALTER TYPE sourcing_mission_status ADD VALUE IF NOT EXISTS 'parse_queued';

CREATE EXTENSION IF NOT EXISTS pgmq;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS supabase_vault;

DO $$
BEGIN
  PERFORM pgmq.create('mission_runs');
EXCEPTION
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END
$$;

ALTER TABLE sourcing_missions
  ADD COLUMN IF NOT EXISTS current_stage TEXT,
  ADD COLUMN IF NOT EXISTS queued_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS running_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error_message TEXT,
  ADD COLUMN IF NOT EXISTS last_error_code TEXT,
  ADD COLUMN IF NOT EXISTS last_queue_message_id TEXT;

CREATE TABLE IF NOT EXISTS sourcing_mission_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES sourcing_missions(id) ON DELETE CASCADE,
  stage_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
  attempt_number INTEGER NOT NULL DEFAULT 1,
  queue_message_id TEXT,
  queued_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  diagnostics JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sourcing_mission_stage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES sourcing_missions(id) ON DELETE CASCADE,
  run_id UUID REFERENCES sourcing_mission_runs(id) ON DELETE SET NULL,
  stage_name TEXT NOT NULL,
  event_name TEXT NOT NULL,
  diagnostics JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sourcing_mission_runs_mission_id_idx
  ON sourcing_mission_runs(mission_id, created_at DESC);
CREATE INDEX IF NOT EXISTS sourcing_mission_runs_status_idx
  ON sourcing_mission_runs(status);
CREATE INDEX IF NOT EXISTS sourcing_mission_stage_events_mission_id_idx
  ON sourcing_mission_stage_events(mission_id, created_at DESC);

ALTER TABLE sourcing_mission_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sourcing_mission_stage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read sourcing mission runs"
  ON sourcing_mission_runs FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Service role can manage sourcing mission runs"
  ON sourcing_mission_runs FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Auth users can read sourcing mission stage events"
  ON sourcing_mission_stage_events FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Service role can manage sourcing mission stage events"
  ON sourcing_mission_stage_events FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DO $$
BEGIN
  PERFORM cron.unschedule('invoke-mission-queue-every-minute');
EXCEPTION
  WHEN undefined_function THEN NULL;
  WHEN others THEN NULL;
END
$$;

SELECT cron.schedule(
  'invoke-mission-queue-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/mission-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body := jsonb_build_object('source', 'cron', 'time', now())
  ) AS request_id;
  $$
);

