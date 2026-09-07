-- ============================================================================
-- 059_fix_ambiguous_id_regression.sql
-- Run in Supabase Dashboard → SQL Editor
--
-- CRITICAL FIX — regression introduced by 052_checkin_won_flag.sql this
-- morning. Changing the function's return type to
-- RETURNS TABLE (id uuid, won boolean) implicitly creates a PL/pgSQL
-- variable named `id` in scope for the whole function body. The line
--   SELECT * INTO v_settings FROM academy_settings WHERE id = 1;
-- has an UNQUALIFIED `id`, which Postgres could previously only resolve to
-- academy_settings.id — but now can equally mean the function's own output
-- column `id`, so it started raising "column reference \"id\" is ambiguous"
-- on every single call.
--
-- Impact confirmed via logs: every AM check-in today succeeded (they ran
-- before this migration was deployed), but essentially EVERY lunch and
-- end-of-day check-in since ~13:30 today failed with this error — surfaced
-- to students as a generic "Check-in failed" message, and reported live by
-- Chaid as a student unable to check out while standing right next to him.
--
-- Fix: qualify the reference as academy_settings.id. No other behavioural
-- change.
--
-- Idempotent: safe to re-run.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.submit_daily_check_in(
  p_phase           text,
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

  SELECT * INTO v_settings FROM academy_settings WHERE academy_settings.id = 1;

  IF p_nfc_token IS DISTINCT FROM v_settings.nfc_token THEN
    RAISE EXCEPTION 'Invalid check-in token';
  END IF;

  IF p_phase = 'am' AND (v_local < v_settings.am_window_start OR v_local > v_settings.am_window_end) THEN
    RAISE EXCEPTION 'Outside morning check-in window (% – %)', v_settings.am_window_start, v_settings.am_window_end;
  END IF;
  IF p_phase = 'lunch' AND (v_local < v_settings.lunch_window_start OR v_local > v_settings.lunch_window_end) THEN
    RAISE EXCEPTION 'Outside lunch check-in window (% – %)', v_settings.lunch_window_start, v_settings.lunch_window_end;
  END IF;
  IF p_phase = 'pm' AND (v_local < v_settings.pm_window_start OR v_local > v_settings.pm_window_end) THEN
    RAISE EXCEPTION 'Outside afternoon check-in window (% – %)', v_settings.pm_window_start, v_settings.pm_window_end;
  END IF;

  IF p_geo_lat IS NULL OR p_geo_lng IS NULL THEN
    v_flagged := true;
    v_reason  := 'No GPS provided';
  ELSE
    v_dist_m := 111320 * sqrt(
      power(p_geo_lat - v_settings.geo_lat, 2)
      + power((p_geo_lng - v_settings.geo_lng) * cos(radians(v_settings.geo_lat)), 2)
    );
    IF v_dist_m > v_settings.radius_m THEN
      v_flagged := true;
      v_reason  := format('GPS %sm from academy', round(v_dist_m::numeric));
    END IF;
  END IF;

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
