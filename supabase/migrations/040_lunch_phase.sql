-- ============================================================================
-- 040_lunch_phase.sql
-- Run in Supabase Dashboard → SQL Editor
--
-- On-site attendance moves from two daily taps (am/pm) to three:
-- morning arrival → lunch → end-of-day finish, all via the NFC sticker at
-- reception (or the geofenced in-app button). This migration:
--
--   a. adds the 8 lunch_* evidence columns to daily_attendance, mirroring the
--      am_*/pm_* columns from 017_daily_attendance.sql exactly;
--   b. adds lunch_window_start/lunch_window_end to academy_settings;
--   c. normalises the current wide-open am/pm windows (someone widened the 017
--      defaults to 00:00–11:59 / 12:00–23:59 in prod) into a non-overlapping
--      3-way partition — guarded so it only fires if the windows still hold
--      those exact wide-open values;
--   c2. widens the attendance_sessions.session_type CHECK to the full
--      schedule_slots vocabulary (016_schedule_v2.sql);
--   d. replaces submit_daily_check_in with a 3-phase, first-tap-wins version
--      that also flags check-ins with no GPS evidence.
--
-- Idempotent: safe to re-run. Nothing here destroys data.
-- ============================================================================

-- ── a. daily_attendance: lunch evidence columns ─────────────────────────────
-- Types mirror the am_* columns in 017_daily_attendance.sql:
--   *_checked_at timestamptz, *_geo_lat/geo_lng float, *_geo_accuracy_m int,
--   *_selfie_path text, *_client_ip text, *_is_flagged boolean DEFAULT false,
--   *_flag_reason text. All nullable (a row may legitimately have no lunch tap).
ALTER TABLE public.daily_attendance ADD COLUMN IF NOT EXISTS lunch_checked_at     timestamptz;
ALTER TABLE public.daily_attendance ADD COLUMN IF NOT EXISTS lunch_geo_lat        float;
ALTER TABLE public.daily_attendance ADD COLUMN IF NOT EXISTS lunch_geo_lng        float;
ALTER TABLE public.daily_attendance ADD COLUMN IF NOT EXISTS lunch_geo_accuracy_m int;
ALTER TABLE public.daily_attendance ADD COLUMN IF NOT EXISTS lunch_selfie_path    text;
ALTER TABLE public.daily_attendance ADD COLUMN IF NOT EXISTS lunch_client_ip      text;
ALTER TABLE public.daily_attendance ADD COLUMN IF NOT EXISTS lunch_is_flagged     boolean DEFAULT false;
ALTER TABLE public.daily_attendance ADD COLUMN IF NOT EXISTS lunch_flag_reason    text;

-- ── b. academy_settings: lunch window ───────────────────────────────────────
ALTER TABLE public.academy_settings ADD COLUMN IF NOT EXISTS lunch_window_start time NOT NULL DEFAULT '11:00';
ALTER TABLE public.academy_settings ADD COLUMN IF NOT EXISTS lunch_window_end   time NOT NULL DEFAULT '14:30';

-- ── c. Normalise the wide-open windows into a 3-way partition ───────────────
-- Live prod currently has am 00:00–11:59 and pm 12:00–23:59 (the 017 defaults
-- were widened by hand). With a lunch phase in between, overlapping windows
-- would let a single wall-clock time satisfy two phases, so we partition:
--   am    00:00–11:00
--   lunch 11:00–14:30
--   pm    14:30–23:59
-- Guarded on the exact known wide-open values so a re-run — or staff having
-- already tuned real times in the new admin settings UI — is never clobbered.
-- Staff tune the real windows in the admin settings UI after deploy.
UPDATE public.academy_settings
SET am_window_end      = '11:00',
    lunch_window_start = '11:00',
    lunch_window_end   = '14:30',
    pm_window_start    = '14:30',
    updated_at         = now()
WHERE id = 1
  AND am_window_start = '00:00'
  AND am_window_end   = '11:59'
  AND pm_window_start = '12:00';

-- ── c2. attendance_sessions.session_type: allow the schedule vocabulary ─────
-- 013_attendance.sql created an inline CHECK (auto-named
-- attendance_sessions_session_type_check) allowing only
-- ('training','match','classroom'). Sessions generated from schedule_slots
-- (016_schedule_v2.sql) use 'lessons','gym','btec','gcse','tutorial','analysis'
-- too. Drop + re-add by name; 'classroom' is kept for existing rows.
ALTER TABLE public.attendance_sessions
  DROP CONSTRAINT IF EXISTS attendance_sessions_session_type_check;
ALTER TABLE public.attendance_sessions
  ADD CONSTRAINT attendance_sessions_session_type_check
  CHECK (session_type IN (
    'training','match','classroom','lessons','gym','btec','gcse','tutorial','analysis'
  ));

-- ── d. RPC: submit_daily_check_in — 3 phases, first-tap-wins ────────────────
-- Changes vs 017:
--   • p_phase accepts 'am' | 'lunch' | 'pm'; each phase has its own window
--     check against academy_settings (Europe/London wall clock, as before).
--   • Geo: still flags (never rejects — the NFC tap is the presence proof)
--     when GPS is outside radius_m; ADDITIONALLY flags with 'No GPS provided'
--     when p_geo_lat/p_geo_lng are NULL, so a tap with location denied is
--     visible to staff review.
--   • First-tap-wins upsert: on conflict, the phase's columns are only
--     written when that phase's checked_at IS NULL
--     (COALESCE(daily_attendance.X, EXCLUDED.X) for checked_at, and
--     checked_at-gated CASE for the evidence/flag columns) — a re-tap can
--     never rewrite the arrival time, evidence, or flags.
CREATE OR REPLACE FUNCTION public.submit_daily_check_in(
  p_phase           text,            -- 'am' | 'lunch' | 'pm'
  p_nfc_token       text,
  p_geo_lat         float DEFAULT NULL,
  p_geo_lng         float DEFAULT NULL,
  p_geo_accuracy_m  int   DEFAULT NULL,
  p_selfie_path     text  DEFAULT NULL,
  p_client_ip       text  DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user      uuid := auth.uid();
  v_settings  academy_settings%ROWTYPE;
  v_now       timestamptz := now();
  v_local     time := (v_now AT TIME ZONE 'Europe/London')::time;
  v_today     date := (v_now AT TIME ZONE 'Europe/London')::date;
  v_id        uuid;
  v_flagged   boolean := false;
  v_reason    text    := NULL;
  v_dist_m    float;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_phase NOT IN ('am', 'lunch', 'pm') THEN
    RAISE EXCEPTION 'Invalid phase: %', p_phase;
  END IF;

  SELECT * INTO v_settings FROM academy_settings WHERE id = 1;

  -- Verify NFC token matches
  IF p_nfc_token IS DISTINCT FROM v_settings.nfc_token THEN
    RAISE EXCEPTION 'Invalid check-in token';
  END IF;

  -- Verify window (per phase; Europe/London wall clock)
  IF p_phase = 'am' AND (v_local < v_settings.am_window_start OR v_local > v_settings.am_window_end) THEN
    RAISE EXCEPTION 'Outside morning check-in window (% – %)', v_settings.am_window_start, v_settings.am_window_end;
  END IF;
  IF p_phase = 'lunch' AND (v_local < v_settings.lunch_window_start OR v_local > v_settings.lunch_window_end) THEN
    RAISE EXCEPTION 'Outside lunch check-in window (% – %)', v_settings.lunch_window_start, v_settings.lunch_window_end;
  END IF;
  IF p_phase = 'pm' AND (v_local < v_settings.pm_window_start OR v_local > v_settings.pm_window_end) THEN
    RAISE EXCEPTION 'Outside afternoon check-in window (% – %)', v_settings.pm_window_start, v_settings.pm_window_end;
  END IF;

  -- Geo evidence (informational; the NFC tap is the auth).
  -- No GPS at all is itself a flag — staff can see location was denied/absent.
  IF p_geo_lat IS NULL OR p_geo_lng IS NULL THEN
    v_flagged := true;
    v_reason  := 'No GPS provided';
  ELSE
    -- crude flat-earth distance, fine for <1km checks
    v_dist_m := 111320 * sqrt(
      power(p_geo_lat - v_settings.geo_lat, 2)
      + power((p_geo_lng - v_settings.geo_lng) * cos(radians(v_settings.geo_lat)), 2)
    );
    IF v_dist_m > v_settings.radius_m THEN
      v_flagged := true;
      v_reason  := format('GPS %sm from academy', round(v_dist_m::numeric));
    END IF;
  END IF;

  -- First-tap-wins upsert per phase
  IF p_phase = 'am' THEN
    INSERT INTO daily_attendance (
      student_id, attendance_date,
      am_checked_at, am_geo_lat, am_geo_lng, am_geo_accuracy_m,
      am_selfie_path, am_client_ip, am_is_flagged, am_flag_reason
    )
    VALUES (
      v_user, v_today,
      v_now, p_geo_lat, p_geo_lng, p_geo_accuracy_m,
      p_selfie_path, p_client_ip, v_flagged, v_reason
    )
    ON CONFLICT (student_id, attendance_date) DO UPDATE SET
      am_checked_at     = COALESCE(daily_attendance.am_checked_at, EXCLUDED.am_checked_at),
      am_geo_lat        = CASE WHEN daily_attendance.am_checked_at IS NULL THEN EXCLUDED.am_geo_lat        ELSE daily_attendance.am_geo_lat        END,
      am_geo_lng        = CASE WHEN daily_attendance.am_checked_at IS NULL THEN EXCLUDED.am_geo_lng        ELSE daily_attendance.am_geo_lng        END,
      am_geo_accuracy_m = CASE WHEN daily_attendance.am_checked_at IS NULL THEN EXCLUDED.am_geo_accuracy_m ELSE daily_attendance.am_geo_accuracy_m END,
      am_selfie_path    = CASE WHEN daily_attendance.am_checked_at IS NULL THEN EXCLUDED.am_selfie_path    ELSE daily_attendance.am_selfie_path    END,
      am_client_ip      = CASE WHEN daily_attendance.am_checked_at IS NULL THEN EXCLUDED.am_client_ip      ELSE daily_attendance.am_client_ip      END,
      am_is_flagged     = CASE WHEN daily_attendance.am_checked_at IS NULL THEN EXCLUDED.am_is_flagged     ELSE daily_attendance.am_is_flagged     END,
      am_flag_reason    = CASE WHEN daily_attendance.am_checked_at IS NULL THEN EXCLUDED.am_flag_reason    ELSE daily_attendance.am_flag_reason    END,
      updated_at        = now()
    RETURNING id INTO v_id;
  ELSIF p_phase = 'lunch' THEN
    INSERT INTO daily_attendance (
      student_id, attendance_date,
      lunch_checked_at, lunch_geo_lat, lunch_geo_lng, lunch_geo_accuracy_m,
      lunch_selfie_path, lunch_client_ip, lunch_is_flagged, lunch_flag_reason
    )
    VALUES (
      v_user, v_today,
      v_now, p_geo_lat, p_geo_lng, p_geo_accuracy_m,
      p_selfie_path, p_client_ip, v_flagged, v_reason
    )
    ON CONFLICT (student_id, attendance_date) DO UPDATE SET
      lunch_checked_at     = COALESCE(daily_attendance.lunch_checked_at, EXCLUDED.lunch_checked_at),
      lunch_geo_lat        = CASE WHEN daily_attendance.lunch_checked_at IS NULL THEN EXCLUDED.lunch_geo_lat        ELSE daily_attendance.lunch_geo_lat        END,
      lunch_geo_lng        = CASE WHEN daily_attendance.lunch_checked_at IS NULL THEN EXCLUDED.lunch_geo_lng        ELSE daily_attendance.lunch_geo_lng        END,
      lunch_geo_accuracy_m = CASE WHEN daily_attendance.lunch_checked_at IS NULL THEN EXCLUDED.lunch_geo_accuracy_m ELSE daily_attendance.lunch_geo_accuracy_m END,
      lunch_selfie_path    = CASE WHEN daily_attendance.lunch_checked_at IS NULL THEN EXCLUDED.lunch_selfie_path    ELSE daily_attendance.lunch_selfie_path    END,
      lunch_client_ip      = CASE WHEN daily_attendance.lunch_checked_at IS NULL THEN EXCLUDED.lunch_client_ip      ELSE daily_attendance.lunch_client_ip      END,
      lunch_is_flagged     = CASE WHEN daily_attendance.lunch_checked_at IS NULL THEN EXCLUDED.lunch_is_flagged     ELSE daily_attendance.lunch_is_flagged     END,
      lunch_flag_reason    = CASE WHEN daily_attendance.lunch_checked_at IS NULL THEN EXCLUDED.lunch_flag_reason    ELSE daily_attendance.lunch_flag_reason    END,
      updated_at           = now()
    RETURNING id INTO v_id;
  ELSE
    INSERT INTO daily_attendance (
      student_id, attendance_date,
      pm_checked_at, pm_geo_lat, pm_geo_lng, pm_geo_accuracy_m,
      pm_selfie_path, pm_client_ip, pm_is_flagged, pm_flag_reason
    )
    VALUES (
      v_user, v_today,
      v_now, p_geo_lat, p_geo_lng, p_geo_accuracy_m,
      p_selfie_path, p_client_ip, v_flagged, v_reason
    )
    ON CONFLICT (student_id, attendance_date) DO UPDATE SET
      pm_checked_at     = COALESCE(daily_attendance.pm_checked_at, EXCLUDED.pm_checked_at),
      pm_geo_lat        = CASE WHEN daily_attendance.pm_checked_at IS NULL THEN EXCLUDED.pm_geo_lat        ELSE daily_attendance.pm_geo_lat        END,
      pm_geo_lng        = CASE WHEN daily_attendance.pm_checked_at IS NULL THEN EXCLUDED.pm_geo_lng        ELSE daily_attendance.pm_geo_lng        END,
      pm_geo_accuracy_m = CASE WHEN daily_attendance.pm_checked_at IS NULL THEN EXCLUDED.pm_geo_accuracy_m ELSE daily_attendance.pm_geo_accuracy_m END,
      pm_selfie_path    = CASE WHEN daily_attendance.pm_checked_at IS NULL THEN EXCLUDED.pm_selfie_path    ELSE daily_attendance.pm_selfie_path    END,
      pm_client_ip      = CASE WHEN daily_attendance.pm_checked_at IS NULL THEN EXCLUDED.pm_client_ip      ELSE daily_attendance.pm_client_ip      END,
      pm_is_flagged     = CASE WHEN daily_attendance.pm_checked_at IS NULL THEN EXCLUDED.pm_is_flagged     ELSE daily_attendance.pm_is_flagged     END,
      updated_at        = now()
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_daily_check_in(text, text, float, float, int, text, text) TO authenticated;

-- ── Verification (run after applying) ───────────────────────────────────────
-- 1. Lunch columns exist on daily_attendance (expect 8 rows):
--    SELECT column_name, data_type FROM information_schema.columns
--    WHERE table_name = 'daily_attendance' AND column_name LIKE 'lunch_%'
--    ORDER BY column_name;
--
-- 2. Windows are a non-overlapping partition (expect 11:00 / 11:00 / 14:30 / 14:30):
--    SELECT am_window_start, am_window_end, lunch_window_start, lunch_window_end,
--           pm_window_start, pm_window_end
--    FROM academy_settings WHERE id = 1;
--
-- 3. session_type CHECK includes the schedule vocabulary:
--    SELECT pg_get_constraintdef(oid) FROM pg_constraint
--    WHERE conname = 'attendance_sessions_session_type_check';
--
-- 4. RPC accepts 'lunch' (run as an authenticated student during the lunch
--    window, with the real nfc_token):
--    SELECT public.submit_daily_check_in('lunch', '<nfc_token>', NULL, NULL);
--    -- then confirm the row is flagged 'No GPS provided' and that a second
--    -- call does NOT change lunch_checked_at:
--    SELECT lunch_checked_at, lunch_is_flagged, lunch_flag_reason
--    FROM daily_attendance
--    WHERE student_id = auth.uid()
--      AND attendance_date = (now() AT TIME ZONE 'Europe/London')::date;
