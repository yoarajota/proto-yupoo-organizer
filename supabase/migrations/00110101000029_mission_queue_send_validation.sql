-- 029_mission_queue_send_validation.sql
-- mission_queue_send is executable by any authenticated user; restrict it to
-- the single mission queue and to well-formed mission messages.

CREATE OR REPLACE FUNCTION public.mission_queue_send(
  queue_name TEXT,
  message JSONB,
  sleep_seconds INTEGER DEFAULT 0
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq, extensions
AS $$
DECLARE
  message_id BIGINT;
BEGIN
  IF queue_name IS DISTINCT FROM 'mission_runs' THEN
    RAISE EXCEPTION 'Unknown queue: %', queue_name USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(message) IS DISTINCT FROM 'object'
     OR NOT (message ? 'mission_id' AND message ? 'stage') THEN
    RAISE EXCEPTION 'Invalid mission queue message' USING ERRCODE = '22023';
  END IF;

  SELECT pgmq.send(queue_name, message, sleep_seconds) INTO message_id;
  RETURN message_id;
END;
$$;
