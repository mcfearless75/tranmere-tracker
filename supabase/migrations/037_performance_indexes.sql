-- 037: Performance indexes flagged by the July 2026 audit.
-- Columns verified against migrations 001, 002, 003, 011 and 013 before writing.
--
-- Deliberately NOT indexed (verified against the schema):
--   * match_events(match_id)        — match_events IS the matches table; it has no match_id column.
--   * match_squads(match_id)        — covered by the unique(match_id, player_id) constraint's index.
--   * attendance_records(session_id)— covered by the UNIQUE(session_id, student_id) constraint's index.
--   * attendance_sessions(session_date) — no such column; sessions use opens_at/created_at timestamps.
--   * push_subscriptions(user_id)   — covered by the unique(user_id, endpoint) constraint's index.
--   * chat_members(room_id)         — room_id is the leading column of the primary key (room_id, user_id).
--
-- Note: the audit named nutrition_logs(user_id), training_logs(user_id) and
-- attendance_records(user_id); the actual column on all three tables is student_id.

-- GPS dashboard and player trend queries filter by player and date range.
create index if not exists gps_sessions_player_date_idx
  on public.gps_sessions (player_id, session_date desc);

-- Attendance history per student (the unique index leads on session_id, not student_id).
create index if not exists attendance_records_student_id_idx
  on public.attendance_records (student_id);

-- Role lookups run in middleware and admin user lists.
create index if not exists users_role_idx
  on public.users (role);

-- Per-student nutrition history, always filtered by student and date.
create index if not exists nutrition_logs_student_date_idx
  on public.nutrition_logs (student_id, logged_date desc);

-- Per-student training history, always filtered by student and date.
create index if not exists training_logs_student_date_idx
  on public.training_logs (student_id, session_date desc);
