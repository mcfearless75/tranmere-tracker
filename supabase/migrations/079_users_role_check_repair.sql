-- ============================================================================
-- 079_users_role_check_repair.sql
-- Run in Supabase Dashboard → SQL Editor
--
-- 2026-09-21: repairs users_role_check, which had been stuck on
-- 012_chat_bot.sql's definition — (admin, coach, teacher, student, bot),
-- with NO 'parent'.
--
-- 022_add_parent_teacher_roles.sql was meant to add 'parent', but as written
-- it re-added the constraint without 'bot'. ADD CONSTRAINT validates existing
-- rows, so it failed against the AI Coach user
-- (00000000-0000-0000-0000-000000000099, role 'bot') with
-- "23514 ... is violated by some row" and left 012's constraint in place.
--
-- Because 'parent' was therefore never permitted, the entire parent portal
-- was dead in production: app/api/admin/invite-parent/route.ts creates the
-- auth user, then upserts the profile with role = 'parent', hits this
-- constraint, deletes the auth user it just created and returns 400.
-- Confirmed before this migration: 0 users with role 'parent', 0 rows in
-- parent_student_links, despite 077_parent_chat.sql having shipped the
-- Parents room and staff-parent DMs.
--
-- This only WIDENS the permitted set, so it cannot invalidate an existing
-- row. 022 has also been corrected in place for the benefit of fresh
-- replays (Supabase preview branches), which had been failing there since
-- 2026-08-02.
--
-- Idempotent: safe to re-run.
-- ============================================================================

alter table public.users
  drop constraint if exists users_role_check;

alter table public.users
  add constraint users_role_check
  check (role in ('student', 'coach', 'admin', 'teacher', 'parent', 'bot'));
