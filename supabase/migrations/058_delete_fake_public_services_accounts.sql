-- ============================================================================
-- 058_delete_fake_public_services_accounts.sql
-- Run in Supabase Dashboard → SQL Editor
--
-- Permanently deletes the 10 "Level 2 Public Services / Fitness" accounts
-- soft-hidden by 053_users_is_active.sql. Paul confirmed 2026-09-07 that
-- course doesn't exist at the academy — these are stale/test data, not real
-- students. This is the follow-up he explicitly asked for after "leave them
-- hidden" was reconsidered.
--
-- FK audit performed first, per this repo's CLAUDE.md rule (grep
-- "REFERENCES public.users" across migrations, then verify against the LIVE
-- schema via information_schema — constraints can drift from migration
-- files). Every FK from another table to public.users was checked:
--   • ON DELETE CASCADE / SET NULL columns (ai_player_reports,
--     assignment_grades, assignment_messages, attendance_checkin_rejections,
--     attendance_records, bursaries, bursary_payments, chat_members,
--     chat_messages, daily_attendance, gps_roster_members, gps_sessions
--     (player_id), learner_reviews, match_squads, native_push_tokens,
--     parent_student_links, safeguarding_concerns, safeguarding_notes,
--     wellbeing_surveys, youth_squads) — handled automatically by Postgres.
--   • Every plain NO ACTION FK (attendance_sessions.created_by,
--     calendar_events.created_by, chat_rooms.created_by,
--     document_folders.created_by, documents.uploaded_by,
--     gps_sessions.imported_by, gps_tag_allocations (all 3 columns),
--     gps_tag_sessions.created_by, match_events (coach_id,
--     motm_player_id), match_logs.student_id, nutrition_goals (both
--     columns), nutrition_logs.student_id, prospect_notes.author_id,
--     push_subscriptions.user_id, schedule_templates.created_by,
--     timetable_slots.created_by, training_logs.student_id) — checked
--     against these 10 ids specifically: 0 rows in every one of them.
--   • ONE real hit: submissions.student_id (NOT NULL, NO ACTION) — 30
--     rows, exactly 3 per student, a uniform pattern consistent with
--     seeded/placeholder test data. Deleted below; submission_evidence
--     cascades from submissions automatically so needs no separate step.
--
-- public.users has NO FK to auth.users (linked only by matching id, not a
-- constraint) — the GoTrue auth account for each of these 10 is deleted
-- separately via the admin API in the same operation as this migration
-- (see git commit), not by this SQL alone.
--
-- Idempotent: safe to re-run (deletes are no-ops once already gone).
-- ============================================================================

DELETE FROM public.submissions
WHERE student_id IN (
  '3cfb9e0d-9bc9-40f3-bef7-22b5c5b3a1b0', -- Jack Harrison
  '3ea08289-e5c9-4248-a7ae-97cd23438abb', -- Leo Turner
  '99fca886-80b0-44e1-95a9-55e9472dd034', -- Marcus O'Sullivan
  '0b23c68b-9dc1-492d-9d23-be6305b63177', -- Callum Wright
  '2b0e735e-cfbc-4ea0-b41e-4f46506e7dad', -- Ethan Reid
  '6c0f996d-a7e9-4a27-9015-da4a9d6e4fa3', -- Dylan Matthews
  'e2d68ea6-afb6-47d4-bb08-8b890ca2b5bf', -- Tommy Callaghan
  '8ec8ad9e-2d7e-4e7f-b5ca-5ce5f628a661', -- Sam Briggs
  'ba792715-e366-43e9-94e3-64323c0362ba', -- Riley Owens
  'f3733ff4-7207-4ee6-af78-66447cb6112d'  -- Finley Carter
);

DELETE FROM public.users
WHERE id IN (
  '3cfb9e0d-9bc9-40f3-bef7-22b5c5b3a1b0',
  '3ea08289-e5c9-4248-a7ae-97cd23438abb',
  '99fca886-80b0-44e1-95a9-55e9472dd034',
  '0b23c68b-9dc1-492d-9d23-be6305b63177',
  '2b0e735e-cfbc-4ea0-b41e-4f46506e7dad',
  '6c0f996d-a7e9-4a27-9015-da4a9d6e4fa3',
  'e2d68ea6-afb6-47d4-bb08-8b890ca2b5bf',
  '8ec8ad9e-2d7e-4e7f-b5ca-5ce5f628a661',
  'ba792715-e366-43e9-94e3-64323c0362ba',
  'f3733ff4-7207-4ee6-af78-66447cb6112d'
);

-- ── Verification (run after applying) ───────────────────────────────────────
-- SELECT count(*) FROM public.users WHERE is_active = false; -- expect 6 (was 16)
-- SELECT count(*) FROM public.submissions WHERE student_id IN (<the 10 ids above>); -- expect 0
