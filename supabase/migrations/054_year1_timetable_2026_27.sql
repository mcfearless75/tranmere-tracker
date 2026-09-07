-- ============================================================================
-- 054_year1_timetable_2026_27.sql
-- Run in Supabase Dashboard → SQL Editor
--
-- Loads the real "L3 Yr1A Timetable 2026/27" (college PDF, provided
-- 2026-09-07) as the Year 1 timetable_slots, replacing the 12 stale
-- placeholder slots that were live (different titles/times entirely —
-- Football 1/2/3, Coaching & Leadership Prep/Application, Specialism 1/2,
-- etc. — not what the college actually issued for this year).
--
-- Widens the day_of_week CHECK: the PDF has a real 09:00–10:00 GCSE English
-- session on Wednesday before Match Day, which 046_timetable.sql's
-- constraint (day_of_week IN (1,2,4,5)) would reject outright. Decided with
-- Paul 2026-09-07: widen the schema rather than drop that session. App-side
-- code (TimetableGrid, expandTimetableSlots, timetable-slots API validation)
-- updated in the same change to stop assuming Wednesday can never have a
-- slot — see git history for this migration's commit.
--
-- Idempotent: safe to re-run (delete-then-insert for year_group=1).
-- ============================================================================

ALTER TABLE public.timetable_slots DROP CONSTRAINT IF EXISTS timetable_slots_day_of_week_check;
ALTER TABLE public.timetable_slots ADD CONSTRAINT timetable_slots_day_of_week_check
  CHECK (day_of_week IN (1, 2, 3, 4, 5));

DELETE FROM public.timetable_slots WHERE year_group = 1;

INSERT INTO public.timetable_slots
  (year_group, day_of_week, start_time, end_time, title, location, tutor, created_by)
VALUES
  -- Monday
  (1, 1, '09:00', '10:00', 'BTEC: Coaching and Leadership',        'Tranmere Room 2', 'CW',          'ac222db0-f1e6-42fa-b6ce-4c6061e53bac'),
  (1, 1, '10:00', '11:00', 'Analysis',                              NULL,              NULL,          'ac222db0-f1e6-42fa-b6ce-4c6061e53bac'),
  (1, 1, '11:00', '12:00', 'Training',                              NULL,              'DOD/MH/CW/AW','ac222db0-f1e6-42fa-b6ce-4c6061e53bac'),
  (1, 1, '13:00', '14:00', 'BTEC: Coaching and Leadership',        'Tranmere Room 2', 'CW',          'ac222db0-f1e6-42fa-b6ce-4c6061e53bac'),
  (1, 1, '15:00', '16:00', 'GCSE English',                          'Tranmere Room 2', 'JW',          'ac222db0-f1e6-42fa-b6ce-4c6061e53bac'),
  -- Tuesday
  (1, 2, '10:00', '11:00', 'Analysis',                              NULL,              NULL,          'ac222db0-f1e6-42fa-b6ce-4c6061e53bac'),
  (1, 2, '11:00', '12:00', 'Training',                              NULL,              'DOD/MH/CW/AW','ac222db0-f1e6-42fa-b6ce-4c6061e53bac'),
  (1, 2, '13:00', '15:00', 'BTEC: Employability and Careers',      'Tranmere Room 2', 'RF',          'ac222db0-f1e6-42fa-b6ce-4c6061e53bac'),
  -- Wednesday (match day, but carries this one session beforehand)
  (1, 3, '09:00', '10:00', 'GCSE English (Facilitation)',           'Tranmere Room 2', 'RF',          'ac222db0-f1e6-42fa-b6ce-4c6061e53bac'),
  -- Thursday
  (1, 4, '09:00', '10:00', 'GCSE Maths',                            'Tranmere Room 2', 'HJ',          'ac222db0-f1e6-42fa-b6ce-4c6061e53bac'),
  (1, 4, '11:00', '12:00', 'BTEC: Wellbeing and Performance',      'Tranmere Room 2', 'RF',          'ac222db0-f1e6-42fa-b6ce-4c6061e53bac'),
  (1, 4, '13:00', '15:00', 'BTEC: Wellbeing and Performance',      'Tranmere Room 2', 'RF',          'ac222db0-f1e6-42fa-b6ce-4c6061e53bac'),
  -- Friday
  (1, 5, '09:00', '10:00', 'GCSE Maths (Facilitation)',             'Tranmere Room 2', 'RF',          'ac222db0-f1e6-42fa-b6ce-4c6061e53bac'),
  (1, 5, '11:00', '12:00', 'Training',                              NULL,              'DOD/MH/CW/AW','ac222db0-f1e6-42fa-b6ce-4c6061e53bac'),
  (1, 5, '12:00', '13:00', 'Go Live/Tutorial',                      'Tranmere Room 2', 'RF',          'ac222db0-f1e6-42fa-b6ce-4c6061e53bac'),
  (1, 5, '14:00', '16:00', 'Gym/Workshop',                          'Tranmere Room 2', 'CW',          'ac222db0-f1e6-42fa-b6ce-4c6061e53bac');

-- ── Verification (run after applying) ───────────────────────────────────────
-- SELECT day_of_week, start_time, end_time, title, tutor FROM timetable_slots
-- WHERE year_group = 1 ORDER BY day_of_week, start_time;
-- Expect 16 rows, one of them day_of_week = 3.
