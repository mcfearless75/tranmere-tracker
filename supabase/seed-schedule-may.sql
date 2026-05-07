-- Seeds the Tranmere Academy weekly timetable and generates May 2026 attendance sessions
-- Run in Supabase Dashboard → SQL Editor

DO $$
DECLARE
  v_tid   uuid;
  v_uid   uuid;
  v_day   date;
  v_dow   int;
  v_rows  int;
  v_total int := 0;
BEGIN
  -- Use the first admin account as session owner
  SELECT id INTO v_uid FROM public.users WHERE role = 'admin' ORDER BY created_at LIMIT 1;
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No admin user found — create one first';
  END IF;

  -- ── Create template ────────────────────────────────────────────────────────
  INSERT INTO schedule_templates (name, created_by)
  VALUES ('Tranmere Academy Timetable', v_uid)
  RETURNING id INTO v_tid;

  -- ── Monday (dow=1) ─────────────────────────────────────────────────────────
  INSERT INTO schedule_slots (template_id, day_of_week, slot_order, start_time, end_time, session_type, session_label) VALUES
    (v_tid, 1, 1, '09:00', '10:15', 'btec',     'BTEC'),
    (v_tid, 1, 2, '10:30', '12:00', 'training', 'Training'),
    (v_tid, 1, 3, '13:00', '14:00', 'analysis', 'Analysis'),
    (v_tid, 1, 4, '14:30', '16:00', 'gcse',     'Eng GCSE');

  -- ── Tuesday (dow=2) ────────────────────────────────────────────────────────
  INSERT INTO schedule_slots (template_id, day_of_week, slot_order, start_time, end_time, session_type, session_label) VALUES
    (v_tid, 2, 1, '08:00', '10:15', 'btec',    'BTEC'),
    (v_tid, 2, 2, '10:30', '12:00', 'lessons', 'Lessons'),
    (v_tid, 2, 3, '13:00', '14:30', 'btec',    'BTEC'),
    (v_tid, 2, 4, '14:45', '16:00', 'gcse',    'Eng GCSE');

  -- ── Wednesday (dow=3) — Match Day ─────────────────────────────────────────
  INSERT INTO schedule_slots (template_id, day_of_week, slot_order, start_time, end_time, session_type, session_label) VALUES
    (v_tid, 3, 1, '09:00', '17:00', 'match', 'Match Day');

  -- ── Thursday (dow=4) ───────────────────────────────────────────────────────
  INSERT INTO schedule_slots (template_id, day_of_week, slot_order, start_time, end_time, session_type, session_label) VALUES
    (v_tid, 4, 1, '09:00', '10:30', 'gcse',     'Maths GCSE'),
    (v_tid, 4, 2, '11:00', '12:00', 'tutorial', 'Tutorial'),
    (v_tid, 4, 3, '13:00', '14:30', 'btec',     'BTEC'),
    (v_tid, 4, 4, '14:45', '16:00', 'gym',      'Gym');

  -- ── Friday (dow=5) ─────────────────────────────────────────────────────────
  INSERT INTO schedule_slots (template_id, day_of_week, slot_order, start_time, end_time, session_type, session_label) VALUES
    (v_tid, 5, 1, '09:00', '10:30', 'btec',     'BTEC'),
    (v_tid, 5, 2, '10:30', '12:00', 'training', 'Training'),
    (v_tid, 5, 3, '13:00', '14:30', 'btec',     'BTEC'),
    (v_tid, 5, 4, '14:45', '16:00', 'gcse',     'Maths GCSE');

  -- ── Generate May 2026 attendance sessions ──────────────────────────────────
  FOR v_day IN
    SELECT d::date FROM generate_series('2026-05-01'::date, '2026-05-31'::date, '1 day') d
  LOOP
    v_dow := EXTRACT(DOW FROM v_day)::int;  -- 0=Sun,1=Mon…6=Sat

    CONTINUE WHEN v_dow NOT BETWEEN 1 AND 5;  -- skip weekends

    INSERT INTO attendance_sessions (
      created_by,
      session_type,    -- must match attendance_sessions CHECK constraint
      session_label,
      pin_code,
      pin_expires_at,  -- pre-expired so coach must rotate on the day
      opens_at,
      closes_at,
      scheduled_date
    )
    SELECT
      v_uid,
      -- map schedule types → attendance_sessions allowed types
      CASE s.session_type
        WHEN 'training'  THEN 'training'
        WHEN 'match'     THEN 'match'
        WHEN 'gym'       THEN 'training'
        ELSE 'classroom'   -- btec, gcse, lessons, tutorial, analysis
      END,
      s.session_label,
      upper(substring(md5(random()::text || clock_timestamp()::text) FROM 1 FOR 6)),
      (v_day::timestamp + s.start_time - interval '1 second'),
      (v_day::timestamp + s.start_time),
      (v_day::timestamp + s.end_time),
      v_day
    FROM schedule_slots s
    WHERE s.template_id = v_tid
      AND s.day_of_week = v_dow
    ORDER BY s.slot_order;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_total := v_total + v_rows;
  END LOOP;

  RAISE NOTICE '✓ Template created: %', v_tid;
  RAISE NOTICE '✓ May 2026 sessions generated: %', v_total;
END;
$$;
