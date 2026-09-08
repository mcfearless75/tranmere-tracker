-- ============================================================================
-- 064_safeguarding_nudge_log.sql
-- Run in Supabase Dashboard → SQL Editor (or via the Supabase MCP apply_migration tool)
--
-- Backs the two-stage grace on attendance-safeguarding-check: stage 1 (30 min
-- after pm_window_start) sends a push NUDGE to staff, no case raised yet —
-- most of these resolve themselves (forgot to tap, GPS trouble, running
-- late). Stage 2 (90 min) re-checks; only students STILL unaccounted for get
-- an actual safeguarding_concerns case, exactly as before. This table dedupes
-- stage 1 so the nudge fires once per day, mirroring attendance_sweep_log's
-- role for missed-checkin-sweep.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.attendance_safeguarding_nudge_log (
  attendance_date date PRIMARY KEY,
  sent_at         timestamptz NOT NULL DEFAULT now(),
  notified_count  int NOT NULL
);

ALTER TABLE public.attendance_safeguarding_nudge_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff read safeguarding nudge log" ON public.attendance_safeguarding_nudge_log;
CREATE POLICY "staff read safeguarding nudge log"
  ON public.attendance_safeguarding_nudge_log FOR SELECT
  USING (public.is_staff());

-- Verification:
--   SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'attendance_safeguarding_nudge_log';
--   -- expect 1 row, rowsecurity = true
--   SELECT policyname, cmd FROM pg_policies WHERE tablename = 'attendance_safeguarding_nudge_log';
--   -- expect 1 row: "staff read safeguarding nudge log" (SELECT)
