-- ============================================================================
-- 017_daily_attendance.sql
-- Replaces per-session PIN check-in with one daily AM + PM tap (NFC sticker
-- at the academy entrance encodes a URL with the academy_settings.nfc_token).
-- Per-lesson attendance is INFERRED from AM + PM presence.
-- ============================================================================

-- ── Singleton settings row ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS academy_settings (
  id           int PRIMARY KEY DEFAULT 1,
  name         text NOT NULL DEFAULT 'Tranmere Academy',
  address      text NOT NULL DEFAULT 'Solar Campus, 235 Leasowe Rd, Wallasey CH45 8RE',
  geo_lat      float NOT NULL DEFAULT 53.4209,
  geo_lng      float NOT NULL DEFAULT -3.0867,
  radius_m     int   NOT NULL DEFAULT 250,
  am_window_start time NOT NULL DEFAULT '07:30',
  am_window_end   time NOT NULL DEFAULT '10:30',
  pm_window_start time NOT NULL DEFAULT '14:30',
  pm_window_end   time NOT NULL DEFAULT '17:30',
  nfc_token    text  NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', ''),
  updated_at   timestamptz DEFAULT now(),
  CONSTRAINT one_row CHECK (id = 1)
);

-- Seed the singleton (idempotent)
INSERT INTO academy_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE academy_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "settings_read_all" ON academy_settings;
CREATE POLICY "settings_read_all" ON academy_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "settings_admin_write" ON academy_settings;
CREATE POLICY "settings_admin_write" ON academy_settings FOR UPDATE USING (public.is_staff());

-- ── Daily attendance ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_attendance (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  attendance_date date NOT NULL,

  am_checked_at   timestamptz,
  am_geo_lat      float,
  am_geo_lng      float,
  am_geo_accuracy_m int,
  am_selfie_path  text,
  am_client_ip    text,
  am_is_flagged   boolean DEFAULT false,
  am_flag_reason  text,

  pm_checked_at   timestamptz,
  pm_geo_lat      float,
  pm_geo_lng      float,
  pm_geo_accuracy_m int,
  pm_selfie_path  text,
  pm_client_ip    text,
  pm_is_flagged   boolean DEFAULT false,
  pm_flag_reason  text,

  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),

  UNIQUE(student_id, attendance_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_attendance_date     ON daily_attendance(attendance_date);
CREATE INDEX IF NOT EXISTS idx_daily_attendance_student  ON daily_attendance(student_id, attendance_date DESC);

ALTER TABLE daily_attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "daily_self_read"  ON daily_attendance;
CREATE POLICY "daily_self_read"  ON daily_attendance FOR SELECT
  USING (auth.uid() = student_id OR public.is_staff());

DROP POLICY IF EXISTS "daily_staff_write" ON daily_attendance;
CREATE POLICY "daily_staff_write" ON daily_attendance FOR ALL USING (public.is_staff());

-- ── RPC: submit_daily_check_in ────────────────────────────────────────────
-- Phase = 'am' or 'pm'. Verifies NFC token + window + records evidence.
-- Returns the daily_attendance row id; raises EXCEPTION on bad token or
-- outside window.
CREATE OR REPLACE FUNCTION public.submit_daily_check_in(
  p_phase           text,            -- 'am' | 'pm'
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

  IF p_phase NOT IN ('am', 'pm') THEN
    RAISE EXCEPTION 'Invalid phase: %', p_phase;
  END IF;

  SELECT * INTO v_settings FROM academy_settings WHERE id = 1;

  -- Verify NFC token matches
  IF p_nfc_token IS DISTINCT FROM v_settings.nfc_token THEN
    RAISE EXCEPTION 'Invalid check-in token';
  END IF;

  -- Verify window
  IF p_phase = 'am' AND (v_local < v_settings.am_window_start OR v_local > v_settings.am_window_end) THEN
    RAISE EXCEPTION 'Outside morning check-in window (% – %)', v_settings.am_window_start, v_settings.am_window_end;
  END IF;
  IF p_phase = 'pm' AND (v_local < v_settings.pm_window_start OR v_local > v_settings.pm_window_end) THEN
    RAISE EXCEPTION 'Outside afternoon check-in window (% – %)', v_settings.pm_window_start, v_settings.pm_window_end;
  END IF;

  -- Geo-distance flag (informational; NFC tap is the auth)
  IF p_geo_lat IS NOT NULL AND p_geo_lng IS NOT NULL THEN
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

  -- Upsert
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
      am_checked_at      = EXCLUDED.am_checked_at,
      am_geo_lat         = EXCLUDED.am_geo_lat,
      am_geo_lng         = EXCLUDED.am_geo_lng,
      am_geo_accuracy_m  = EXCLUDED.am_geo_accuracy_m,
      am_selfie_path     = EXCLUDED.am_selfie_path,
      am_client_ip       = EXCLUDED.am_client_ip,
      am_is_flagged      = EXCLUDED.am_is_flagged,
      am_flag_reason     = EXCLUDED.am_flag_reason,
      updated_at         = now()
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
      pm_checked_at      = EXCLUDED.pm_checked_at,
      pm_geo_lat         = EXCLUDED.pm_geo_lat,
      pm_geo_lng         = EXCLUDED.pm_geo_lng,
      pm_geo_accuracy_m  = EXCLUDED.pm_geo_accuracy_m,
      pm_selfie_path     = EXCLUDED.pm_selfie_path,
      pm_client_ip       = EXCLUDED.pm_client_ip,
      pm_is_flagged      = EXCLUDED.pm_is_flagged,
      pm_flag_reason     = EXCLUDED.pm_flag_reason,
      updated_at         = now()
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_daily_check_in(text, text, float, float, int, text, text) TO authenticated;
