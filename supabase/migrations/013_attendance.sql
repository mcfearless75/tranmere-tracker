-- Run in Supabase Dashboard → SQL Editor

-- ── Tables ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS attendance_sessions (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_by      uuid NOT NULL REFERENCES public.users(id),
  session_type    text NOT NULL CHECK (session_type IN ('training', 'match', 'classroom')),
  session_label   text NOT NULL,
  match_event_id  uuid REFERENCES match_events(id) ON DELETE SET NULL,
  pin_code        text NOT NULL,
  pin_expires_at  timestamptz NOT NULL DEFAULT now() + interval '2 minutes',
  opens_at        timestamptz NOT NULL DEFAULT now(),
  closes_at       timestamptz,
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS attendance_records (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id    uuid NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  student_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  method        text NOT NULL DEFAULT 'pin' CHECK (method IN ('pin', 'qr', 'manual')),
  checked_in_at timestamptz DEFAULT now(),

  -- Anti-spoofing audit trail
  client_ip     text,                  -- logged at submission
  geo_lat       numeric(9,6),          -- GPS lat if browser provided it
  geo_lng       numeric(9,6),          -- GPS lng if browser provided it
  geo_accuracy_m numeric(7,1),         -- GPS accuracy in metres
  selfie_path   text,                  -- Supabase Storage path to selfie image
  is_flagged    boolean DEFAULT false, -- set by suspicious check-in rule
  flag_reason   text,                  -- e.g. "IP outside campus subnet"

  UNIQUE(session_id, student_id)
);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records  ENABLE ROW LEVEL SECURITY;

-- Coaches/admins manage sessions
CREATE POLICY "staff manage attendance_sessions"
  ON attendance_sessions FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin','coach'))
  );

-- Students can read open sessions (so they can check their session label)
CREATE POLICY "students read open sessions"
  ON attendance_sessions FOR SELECT
  USING (
    opens_at <= now()
    AND (closes_at IS NULL OR closes_at > now())
  );

-- Coaches/admins see all records; students see their own
CREATE POLICY "staff see all attendance_records"
  ON attendance_records FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin','coach'))
  );

CREATE POLICY "students see own attendance_records"
  ON attendance_records FOR SELECT
  USING (student_id = auth.uid());

-- ── RPC: rotate PIN (coach calls this on a timer) ─────────────────────────────

CREATE OR REPLACE FUNCTION rotate_attendance_pin(p_session_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  new_pin text;
BEGIN
  -- Verify caller is staff
  IF NOT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin','coach')
  ) THEN
    RAISE EXCEPTION 'Unauthorised';
  END IF;

  -- Generate 6-char alphanumeric PIN, avoid ambiguous chars
  SELECT upper(
    translate(
      substring(md5(random()::text || clock_timestamp()::text) FROM 1 FOR 8),
      '0Oil1',
      'ABCDE'
    )
  ) INTO new_pin;
  new_pin := left(new_pin, 6);

  UPDATE attendance_sessions
  SET
    pin_code       = new_pin,
    pin_expires_at = now() + interval '2 minutes'
  WHERE id = p_session_id;

  RETURN new_pin;
END;
$$;

-- ── RPC: student submits PIN (validates server-side) ──────────────────────────

CREATE OR REPLACE FUNCTION submit_attendance(
  p_session_id  uuid,
  p_pin         text,
  p_client_ip   text   DEFAULT NULL,
  p_geo_lat     numeric DEFAULT NULL,
  p_geo_lng     numeric DEFAULT NULL,
  p_geo_accuracy_m numeric DEFAULT NULL,
  p_selfie_path text   DEFAULT NULL,
  -- Campus subnet prefix, e.g. '192.168.1.' — set to your academy WiFi range
  p_campus_ip_prefix text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_session       attendance_sessions%ROWTYPE;
  v_student_id    uuid := auth.uid();
  v_flagged       boolean := false;
  v_flag_reasons  text[] := '{}';
  v_seconds_left  numeric;
BEGIN
  SELECT * INTO v_session FROM attendance_sessions WHERE id = p_session_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Session not found');
  END IF;

  IF now() < v_session.opens_at THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Session not open yet');
  END IF;

  IF v_session.closes_at IS NOT NULL AND now() > v_session.closes_at THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This session is closed');
  END IF;

  IF v_session.pin_expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PIN has expired — ask your coach to refresh it');
  END IF;

  IF upper(trim(p_pin)) <> upper(v_session.pin_code) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Incorrect PIN — check the code and try again');
  END IF;

  -- ── Suspicious check-in detection ────────────────────────────────────────

  -- Flag if IP is outside campus subnet (when campus prefix is configured)
  IF p_campus_ip_prefix IS NOT NULL AND p_client_ip IS NOT NULL THEN
    IF NOT (p_client_ip LIKE p_campus_ip_prefix || '%') THEN
      v_flagged := true;
      v_flag_reasons := array_append(v_flag_reasons, 'IP outside campus network (' || p_client_ip || ')');
    END IF;
  END IF;

  -- Flag if submitted in last 20 seconds of PIN window (code likely forwarded)
  v_seconds_left := extract(epoch FROM (v_session.pin_expires_at - now()));
  IF v_seconds_left < 20 THEN
    v_flagged := true;
    v_flag_reasons := array_append(v_flag_reasons, 'Submitted in final 20s of PIN window (possible forwarded code)');
  END IF;

  -- Flag if GPS provided but far from session location (if session has coordinates)
  -- (extend attendance_sessions with lat/lng to enable this check)

  -- ── Insert record ─────────────────────────────────────────────────────────
  INSERT INTO attendance_records (
    session_id, student_id, method,
    client_ip, geo_lat, geo_lng, geo_accuracy_m,
    selfie_path, is_flagged, flag_reason
  )
  VALUES (
    p_session_id, v_student_id, 'pin',
    p_client_ip, p_geo_lat, p_geo_lng, p_geo_accuracy_m,
    p_selfie_path,
    v_flagged,
    CASE WHEN array_length(v_flag_reasons, 1) > 0
         THEN array_to_string(v_flag_reasons, '; ')
         ELSE NULL END
  )
  ON CONFLICT (session_id, student_id) DO NOTHING;

  RETURN jsonb_build_object(
    'ok', true,
    'label', v_session.session_label,
    'flagged', v_flagged
  );
END;
$$;

-- ── RPC: coach manual override ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION mark_attendance_manual(
  p_session_id uuid,
  p_student_id uuid,
  p_present    boolean
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin','coach')
  ) THEN
    RAISE EXCEPTION 'Unauthorised';
  END IF;

  IF p_present THEN
    INSERT INTO attendance_records (session_id, student_id, method)
    VALUES (p_session_id, p_student_id, 'manual')
    ON CONFLICT (session_id, student_id) DO UPDATE SET method = 'manual', checked_in_at = now();
  ELSE
    DELETE FROM attendance_records
    WHERE session_id = p_session_id AND student_id = p_student_id;
  END IF;
END;
$$;
