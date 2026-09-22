-- ============================================================================
-- 083_replace_schedule_slots_rpc.sql
-- Run in Supabase Dashboard → SQL Editor (or via the Supabase MCP apply_migration)
--
-- /api/attendance/save-schedule replaced the week's slots with an unchecked
-- DELETE followed by an unchecked INSERT, then returned {templateId} — i.e.
-- success — whatever either statement actually did. Delete succeeds, insert
-- fails, and the entire weekly schedule the college runs on is gone while the
-- admin who pressed Save is told it saved.
--
-- Checking both errors in the route would report that failure but not prevent
-- it: two PostgREST calls are two transactions, so the DELETE has already
-- committed by the time the INSERT fails. PostgREST runs one RPC call in one
-- transaction, so moving both statements into a single function makes the
-- replacement atomic — any failure in the INSERT rolls the DELETE back with
-- it and the previous schedule survives untouched.
--
-- Deliberately SECURITY INVOKER (the default). The only caller is the route's
-- service-role client, which bypasses RLS anyway, so DEFINER would buy nothing
-- and would hand any authenticated user who found this function a one-call
-- "wipe the schedule" primitive. EXECUTE is granted to service_role alone.
--
-- Idempotent: safe to re-run.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.replace_schedule_slots(
  p_template_id uuid,
  p_slots       jsonb
)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_inserted integer;
BEGIN
  IF p_template_id IS NULL THEN
    RAISE EXCEPTION 'replace_schedule_slots: p_template_id is required';
  END IF;

  -- Validate the shape BEFORE the delete. jsonb_array_elements on an object
  -- or a null raises too, but only after the old rows are already gone within
  -- this transaction — cheap to fail early and it keeps the error legible.
  IF p_slots IS NULL OR jsonb_typeof(p_slots) <> 'array' THEN
    RAISE EXCEPTION 'replace_schedule_slots: p_slots must be a JSON array';
  END IF;

  DELETE FROM public.schedule_slots WHERE template_id = p_template_id;

  -- An empty array is a legitimate "clear the whole week" — the delete stands
  -- and nothing is inserted.
  INSERT INTO public.schedule_slots
    (template_id, day_of_week, slot_order, start_time, end_time, session_type, session_label)
  SELECT
    p_template_id,
    (s ->> 'day_of_week')::int,
    (s ->> 'slot_order')::int,
    (s ->> 'start_time')::time,
    (s ->> 'end_time')::time,
     s ->> 'session_type',
     s ->> 'session_label'
  FROM jsonb_array_elements(p_slots) AS s;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

-- Note: the RAISE EXCEPTIONs above deliberately use the default SQLSTATE
-- (P0001). A custom 40001 would read as a transient serialization failure and
-- make PostgREST retry the call in a loop.

REVOKE ALL ON FUNCTION public.replace_schedule_slots(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.replace_schedule_slots(uuid, jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_schedule_slots(uuid, jsonb) TO service_role;
