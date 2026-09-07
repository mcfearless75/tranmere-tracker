-- ============================================================================
-- 052_checkin_won_flag.sql
-- Run in Supabase Dashboard → SQL Editor
--
-- Bug: submit_daily_check_in() is first-tap-wins at the DATA level (a
-- concurrent duplicate call never overwrites checked_at/geo/flags), but it
-- always returned success with no way for the caller to tell whether ITS
-- call was the one that actually wrote the row, or a no-op race loser.
-- app/api/attendance/check-in/route.ts fires the parent "checked in" push
-- and the staff "flagged check-in" push unconditionally after every call —
-- so when the NFC App Link double-dispatches (a known Android behaviour when
-- a tag is held near the reader a moment too long) and opens the check-in
-- page twice, both requests race the RPC and BOTH send notifications for
-- what was physically a single tap. With two push_subscriptions rows per
-- staff device (browser tab + installed PWA), that's 4 duplicate pushes for
-- one flagged check-in.
--
-- Fix: return whether THIS call's request actually set checked_at (compare
-- the row's checked_at after the upsert to the v_now this call generated —
-- equal means this call won; different means another call already got there
-- first). Return type changes from `uuid` to `TABLE(id uuid, won boolean)`
-- so callers can gate notifications on `won`. Postgres can't change a
-- function's return type via CREATE OR REPLACE, so this drops + recreates.
--
-- Bonus fix found while rewriting this function: the 'pm' branch's ON
-- CONFLICT DO UPDATE SET list in 040_lunch_phase.sql was missing
-- pm_flag_reason (am/lunch both set it, pm didn't). Since a pm tap almost
-- always hits the UPDATE path — the row already exists from that day's am/
-- lunch check-in — pm_flag_reason was silently staying NULL even when
-- pm_is_flagged was correctly set to true. Added it back below.
--
-- Idempotent: safe to re-run.
-- ============================================================================

DROP FUNCTION IF EXISTS public.submit_daily_check_in(text, text, float, float, int, text, text);

CREATE FUNCTION public.submit_daily_check_in(
  p_phase           text,            -- 'am' | 'lunch' | 'pm'
  p_nfc_token       text,
  p_geo_lat         float DEFAULT NULL,
  p_geo_lng         float DEFAULT NULL,
  p_geo_accuracy_m  int   DEFAULT NULL,
  p_selfie_path     text  DEFAULT NULL,
  p_client_ip       text  DEFAULT NULL
)
RETURNS TABLE (id uuid, won boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user        uuid := auth.uid();
  v_settings    academy_settings%ROWTYPE;
  v_now         timestamptz := now();
  v_local       time := (v_now AT TIME ZONE 'Europe/London')::time;
  v_today       date := (v_now AT TIME ZONE 'Europe/London')::date;
  v_id          uuid;
  v_checked_at  timestamptz;
  v_flagged     boolean := false;
  v_reason      text    := NULL;
  v_dist_m      float;
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

  -- First-tap-wins upsert per phase. RETURNING the phase's checked_at (not
  -- just id) lets us tell whether THIS call's v_now is what ended up
  -- persisted, or whether a concurrent racing call already won first.
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
    RETURNING daily_attendance.id, daily_attendance.am_checked_at INTO v_id, v_checked_at;
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
    RETURNING daily_attendance.id, daily_attendance.lunch_checked_at INTO v_id, v_checked_at;
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
      pm_flag_reason    = CASE WHEN daily_attendance.pm_checked_at IS NULL THEN EXCLUDED.pm_flag_reason    ELSE daily_attendance.pm_flag_reason    END,
      updated_at        = now()
    RETURNING daily_attendance.id, daily_attendance.pm_checked_at INTO v_id, v_checked_at;
  END IF;

  RETURN QUERY SELECT v_id, (v_checked_at = v_now);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_daily_check_in(text, text, float, float, int, text, text) TO authenticated;

-- ── Verification (run after applying) ───────────────────────────────────────
-- 1. A normal call still returns one row with won = true:
--    SELECT * FROM submit_daily_check_in('am', '<real-nfc-token>');
--    -- (id, won) with won = true
-- 2. Two concurrent calls for the same student/phase/day: exactly one has
--    won = true, the other won = false — verify manually with pgbench/psql
--    or just watch behaviour: a double NFC dispatch should now only ever
--    produce one staff/parent push, not two.
