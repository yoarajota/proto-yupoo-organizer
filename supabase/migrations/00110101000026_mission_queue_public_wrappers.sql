-- 026_mission_queue_public_wrappers.sql
-- Keep the local API on the public schema while allowing trusted server code
-- to enqueue and consume mission queue messages through validated RPCs.

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
  SELECT pgmq.send(queue_name, message, sleep_seconds) INTO message_id;
  RETURN message_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.mission_queue_read(
  queue_name TEXT,
  sleep_seconds INTEGER DEFAULT 30,
  n INTEGER DEFAULT 5
)
RETURNS TABLE (
  msg_id BIGINT,
  read_ct INTEGER,
  enqueued_at TIMESTAMPTZ,
  vt TIMESTAMPTZ,
  message JSONB
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pgmq, extensions
AS $$
  SELECT msg_id, read_ct, enqueued_at, vt, message
  FROM pgmq.read(queue_name, sleep_seconds, n);
$$;

CREATE OR REPLACE FUNCTION public.mission_queue_delete(
  queue_name TEXT,
  msg_id BIGINT
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pgmq, extensions
AS $$
  SELECT pgmq.delete(queue_name, msg_id);
$$;

REVOKE ALL ON FUNCTION public.mission_queue_send(TEXT, JSONB, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mission_queue_read(TEXT, INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mission_queue_delete(TEXT, BIGINT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.mission_queue_send(TEXT, JSONB, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mission_queue_read(TEXT, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.mission_queue_delete(TEXT, BIGINT) TO service_role;
