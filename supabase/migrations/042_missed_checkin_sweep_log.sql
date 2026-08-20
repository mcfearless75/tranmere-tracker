-- ============================================================================
-- 042_missed_checkin_sweep_log.sql
-- Run in Supabase Dashboard → SQL Editor
--
-- Backs the new missed-checkin-sweep cron: alerts staff shortly after the AM
-- or lunch window closes if any student still hasn't checked in for that
-- phase — closing the gap where a student who leaves site and never attempts
-- a check-in was previously invisible until the once-daily 17:30 PM digest.
-- One row per (date, phase) so the sweep — which runs every 15 minutes to
-- follow the DB-configurable window times — only ever alerts once per phase
-- per day, however many times it re-checks.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.attendance_sweep_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_date date NOT NULL,
  phase           text NOT NULL CHECK (phase IN ('am', 'lunch')),
  missing_count   int NOT NULL DEFAULT 0,
  swept_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (attendance_date, phase)
);

ALTER TABLE public.attendance_sweep_log ENABLE ROW LEVEL SECURITY;

-- Staff-only read (future admin UI); the cron writes via the service role.
DROP POLICY IF EXISTS "staff read sweep log" ON public.attendance_sweep_log;
CREATE POLICY "staff read sweep log"
  ON public.attendance_sweep_log FOR SELECT
  USING (public.is_staff());

-- Verification:
--   SELECT * FROM attendance_sweep_log ORDER BY swept_at DESC LIMIT 20;
