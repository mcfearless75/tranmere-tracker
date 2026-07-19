-- 038_attendance_pin_column_privileges.sql
-- Run in Supabase Dashboard → SQL Editor
--
-- SECURITY FIX (CRITICAL): attendance_sessions.pin_code was readable by any
-- authenticated user — and potentially anon — through the permissive
-- "students read open sessions" RLS policy (013_attendance.sql), which is gated
-- only on the open-session time window and returns the WHOLE row, pin_code
-- included. A student could query the PostgREST endpoint with their own JWT
-- (…/rest/v1/attendance_sessions?select=pin_code) and read the live check-in PIN
-- for every open session, then mark themselves present without attending.
--
-- The current check-in flow verifies a server-side NFC token via the
-- submit_daily_check_in RPC and never needs pin_code on the client. No
-- application query selects pin_code; every server read of this table uses the
-- service-role client, which bypasses column privileges. So we can restrict the
-- column to the service role with zero application changes.
--
-- Postgres note: a column-level REVOKE has no effect while a table-level SELECT
-- grant exists (the table grant implicitly covers every column). We therefore
-- drop the table-level SELECT for anon/authenticated and re-grant SELECT on
-- every column EXCEPT pin_code. service_role is untouched and retains full read.

DO $$
BEGIN
  -- Remove the blanket table-level SELECT so column-level grants take effect.
  REVOKE SELECT ON public.attendance_sessions FROM anon, authenticated;

  -- Re-grant SELECT on every column EXCEPT pin_code.
  -- Full column set as of migration 015 (013 base + scheduled_date).
  GRANT SELECT (
    id,
    created_by,
    session_type,
    session_label,
    match_event_id,
    pin_expires_at,
    opens_at,
    closes_at,
    created_at,
    scheduled_date
  ) ON public.attendance_sessions TO anon, authenticated;
END $$;

-- Verification (run separately; should return 0 rows — pin_code must NOT appear):
--   SELECT grantee, privilege_type, column_name
--   FROM information_schema.column_privileges
--   WHERE table_name = 'attendance_sessions'
--     AND column_name = 'pin_code'
--     AND grantee IN ('anon', 'authenticated');
