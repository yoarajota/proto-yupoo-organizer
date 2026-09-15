-- 027_mission_run_enqueue_rls.sql
-- Authenticated users enqueue mission runs from Server Actions before the
-- service-role Edge Function consumes and updates them.

CREATE POLICY "Mission owners can insert queued mission runs"
  ON sourcing_mission_runs FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND status = 'queued'
    AND EXISTS (
      SELECT 1
      FROM sourcing_missions
      WHERE sourcing_missions.id = sourcing_mission_runs.mission_id
        AND sourcing_missions.created_by = auth.uid()
    )
  );
