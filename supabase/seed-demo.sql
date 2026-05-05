-- =============================================================================
-- Tranmere Tracker — Demo Seed Data
-- =============================================================================
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
--
-- Requirements before running:
--   • At least one student account must exist (signed up via /login)
--   • At least one coach/admin account must exist
--   • Courses and BTEC units must be seeded (from 001_initial_schema.sql)
--
-- Safe to re-run: uses INSERT ... ON CONFLICT DO NOTHING where possible.
-- =============================================================================

DO $$
DECLARE
  v_student_id      uuid;
  v_coach_id        uuid;
  v_course_id       uuid;
  v_unit_id         uuid;
  v_assignment_id   uuid;
  v_match_past_id   uuid;
  v_match_upcoming_id uuid;
  v_squad_past_id   uuid;
  v_squad_upcoming_id uuid;
  v_submission_id   uuid;
  today             date := current_date;
BEGIN

  -- ── Resolve existing users ────────────────────────────────────────────────
  SELECT id INTO v_student_id
    FROM public.users WHERE role = 'student' ORDER BY created_at LIMIT 1;

  SELECT id INTO v_coach_id
    FROM public.users WHERE role IN ('admin', 'coach') ORDER BY created_at LIMIT 1;

  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'No student account found. Sign up as a student first at /login then re-run.';
  END IF;

  IF v_coach_id IS NULL THEN
    RAISE EXCEPTION 'No coach/admin account found. Create one first then re-run.';
  END IF;

  RAISE NOTICE 'Seeding for student: %', v_student_id;
  RAISE NOTICE 'Coach/admin: %', v_coach_id;

  -- ── Resolve course + unit ─────────────────────────────────────────────────
  SELECT id INTO v_course_id FROM courses LIMIT 1;

  -- Assign student to a course if not already set
  UPDATE public.users SET course_id = v_course_id
    WHERE id = v_student_id AND course_id IS NULL;

  SELECT id INTO v_unit_id FROM btec_units WHERE course_id = v_course_id LIMIT 1;

  -- ── GPS Sessions (3 sessions) ─────────────────────────────────────────────
  INSERT INTO gps_sessions (
    player_id, session_date, session_label, source,
    total_distance_m, hsr_distance_m, sprint_distance_m,
    max_speed_ms, max_speed_kmh,
    sprint_count, accel_count, decel_count,
    player_load, hr_avg, hr_max, duration_mins,
    imported_by
  ) VALUES
    (
      v_student_id, today - 14, 'Pre-Season Training', 'statsports',
      8420.0, 1240.0, 380.0,
      8.12, 29.2,
      12, 34, 29,
      892.50, 158, 186, 72.0,
      v_coach_id
    ),
    (
      v_student_id, today - 7, 'vs AFC Fylde U21', 'statsports',
      9180.0, 1560.0, 510.0,
      8.74, 31.5,
      17, 42, 38,
      1043.20, 164, 194, 90.0,
      v_coach_id
    ),
    (
      v_student_id, today - 2, 'Tactical Session', 'statsports',
      6840.0, 820.0, 210.0,
      7.63, 27.5,
      8, 26, 22,
      741.80, 151, 179, 60.0,
      v_coach_id
    );

  -- ── Nutrition Logs (today) ────────────────────────────────────────────────
  INSERT INTO nutrition_logs
    (student_id, logged_date, meal_type, food_name, calories, protein_g, carbs_g, fat_g)
  VALUES
    (v_student_id, today, 'breakfast', 'Porridge with banana and honey', 380, 12.0, 68.0, 6.5),
    (v_student_id, today, 'breakfast', 'Orange juice (200ml)',            86,  1.0, 20.0, 0.2),
    (v_student_id, today, 'lunch',     'Chicken wrap with salad',         520, 38.0, 48.0, 12.0),
    (v_student_id, today, 'lunch',     'Greek yoghurt',                  130, 14.0,  9.0,  3.5),
    (v_student_id, today, 'snack',     'Protein shake (vanilla)',         220, 28.0, 18.0,  4.0),
    (v_student_id, today, 'dinner',    'Grilled salmon with rice & veg',  620, 44.0, 62.0, 16.0);

  -- ── Training Log ──────────────────────────────────────────────────────────
  INSERT INTO training_logs
    (student_id, session_date, session_type, duration_mins, intensity, notes)
  VALUES
    (v_student_id, today - 3, 'Strength & Conditioning', 60, 'high',
     'Squats, deadlifts, plyometrics. PB on box jumps.'),
    (v_student_id, today - 6, 'Pitch Session', 75, 'high',
     'Tactical drills, small-sided games, set pieces.'),
    (v_student_id, today - 10, 'Recovery / Mobility', 40, 'low',
     'Foam rolling, yoga, light stretching.');

  -- ── Past Match (completed) ────────────────────────────────────────────────
  INSERT INTO match_events (id, coach_id, match_date, opponent, location, status, notes)
  VALUES (
    uuid_generate_v4(),
    v_coach_id,
    today - 7,
    'AFC Fylde U21',
    'Prenton Park',
    'completed',
    'Hard-fought win. Good pressing game in the second half.'
  )
  RETURNING id INTO v_match_past_id;

  INSERT INTO match_squads (id, match_id, player_id, status, position, coach_rating, coach_notes)
  VALUES (
    uuid_generate_v4(),
    v_match_past_id,
    v_student_id,
    'accepted',
    'Centre Midfield',
    8,
    'Excellent work rate. Distribution improved. Keep pressing high.'
  )
  RETURNING id INTO v_squad_past_id;

  -- ── Upcoming Match (next week) ────────────────────────────────────────────
  INSERT INTO match_events (id, coach_id, match_date, opponent, location, status, notes)
  VALUES (
    uuid_generate_v4(),
    v_coach_id,
    today + 7,
    'Southport FC U21',
    'Pure Stadium, Southport',
    'upcoming',
    'Lancashire County Cup. Full squad required. Arrive 1 hour early.'
  )
  RETURNING id INTO v_match_upcoming_id;

  INSERT INTO match_squads (id, match_id, player_id, status)
  VALUES (
    uuid_generate_v4(),
    v_match_upcoming_id,
    v_student_id,
    'invited'
  )
  RETURNING id INTO v_squad_upcoming_id;

  -- ── Assignment + Submission ───────────────────────────────────────────────
  IF v_unit_id IS NOT NULL THEN
    INSERT INTO assignments (id, unit_id, title, description, due_date, grade_target)
    VALUES (
      uuid_generate_v4(),
      v_unit_id,
      'Personal Fitness Assessment Report',
      'Conduct a full fitness assessment including VO2 max estimation, strength tests, and flexibility. Write a 1,500-word report analysing your results and setting SMART targets for the next 8 weeks.',
      today + 14,
      'Merit'
    )
    RETURNING id INTO v_assignment_id;

    INSERT INTO submissions
      (assignment_id, student_id, status, grade, feedback, submitted_at)
    VALUES (
      v_assignment_id,
      v_student_id,
      'graded',
      'Merit',
      'Good analysis of test results and clear SMART targets. To reach Distinction, extend your evaluation section — compare your results against published norms for your age group and explain any variances.',
      now() - interval '2 days'
    )
    ON CONFLICT (assignment_id, student_id) DO NOTHING;

    -- Second upcoming assignment (not yet submitted)
    INSERT INTO assignments (id, unit_id, title, description, due_date, grade_target)
    VALUES (
      uuid_generate_v4(),
      v_unit_id,
      'Nutritional Planning Portfolio',
      'Create a 7-day meal plan for a professional footballer in pre-season. Include macro targets, hydration strategy, and pre/post-match meal timings. Justify choices with sports science research.',
      today + 21,
      'Distinction'
    );
  END IF;

  -- ── Nutrition goal for student ────────────────────────────────────────────
  INSERT INTO nutrition_goals (student_id, calories, protein_g, carbs_g, fat_g, set_by)
  VALUES (v_student_id, 2800, 160, 320, 85, v_coach_id)
  ON CONFLICT (student_id) DO NOTHING;

  RAISE NOTICE '✅ Demo seed complete.';
  RAISE NOTICE '   GPS sessions:    3';
  RAISE NOTICE '   Nutrition logs:  6 items (today)';
  RAISE NOTICE '   Training logs:   3 sessions';
  RAISE NOTICE '   Past match:      vs AFC Fylde U21 (completed, rated 8/10)';
  RAISE NOTICE '   Upcoming match:  vs Southport FC U21 (invitation pending)';
  RAISE NOTICE '   Assignments:     2 (1 graded Merit, 1 upcoming)';
  RAISE NOTICE '   Nutrition goal:  2800 kcal / 160g protein';

END $$;
