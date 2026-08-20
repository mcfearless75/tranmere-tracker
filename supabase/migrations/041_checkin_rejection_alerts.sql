-- ============================================================================
-- 041_checkin_rejection_alerts.sql
-- Run in Supabase Dashboard → SQL Editor
--
-- The in-app check-in button (tap-checkin) hard-rejects (422) when a student
-- is outside the academy geofence — by design, so a student can't check in
-- from home. But a rejection previously vanished into the response: nothing
-- told staff a student tried and failed to check in off-site, so a student
-- who genuinely didn't return after lunch produced no signal until someone
-- happened to look at the day view.
--
-- This table records each first rejection per student/phase/day and backs a
-- staff push notification (wired in app/api/attendance/tap-checkin). Repeat
-- taps while still out of range update the same row instead of re-alerting,
-- so a student mashing the button waiting for GPS doesn't spam staff.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.attendance_checkin_rejections (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  attendance_date   date NOT NULL,
  phase             text NOT NULL CHECK (phase IN ('am', 'lunch', 'pm')),
  distance_m        float,              -- null when no GPS was provided at all
  first_rejected_at timestamptz NOT NULL DEFAULT now(),
  last_rejected_at  timestamptz NOT NULL DEFAULT now(),
  attempt_count     int NOT NULL DEFAULT 1,
  staff_notified_at timestamptz,
  UNIQUE (student_id, attendance_date, phase)
);

CREATE INDEX IF NOT EXISTS attendance_checkin_rejections_date_idx
  ON public.attendance_checkin_rejections (attendance_date);

ALTER TABLE public.attendance_checkin_rejections ENABLE ROW LEVEL SECURITY;

-- Staff-only read (future admin UI); all writes go through the service role
-- from the tap-checkin route, so no INSERT/UPDATE grant is needed for anon
-- or authenticated.
DROP POLICY IF EXISTS "staff read checkin rejections" ON public.attendance_checkin_rejections;
CREATE POLICY "staff read checkin rejections"
  ON public.attendance_checkin_rejections FOR SELECT
  USING (public.is_staff());

-- Verification:
--   SELECT * FROM attendance_checkin_rejections ORDER BY last_rejected_at DESC LIMIT 20;
