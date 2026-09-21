-- Migration 022: Add 'parent' and 'teacher' to the users role constraint
-- Run in Supabase SQL Editor

-- Drop old constraint and add the extended one
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('student', 'coach', 'admin', 'teacher', 'parent', 'bot'));

-- 2026-09-21: 'bot' added above. As originally written this migration
-- dropped it: 012_chat_bot.sql had widened the constraint to include 'bot'
-- and inserted the AI Coach user (00000000-0000-0000-0000-000000000099,
-- role 'bot'), so re-adding the constraint without it failed validation with
-- "23514 ... is violated by some row" against that row.
--
-- That failure was silent and had two consequences:
--   * this migration never took effect in production — the live constraint
--     was still 012's, with no 'parent', so role = 'parent' was rejected and
--     the parent portal could never create anyone (0 parents, 0
--     parent_student_links at the time of this fix);
--   * every fresh replay died here, which is why the Supabase preview
--     branch had been MIGRATIONS_FAILED since 2026-08-02.
--
-- Safe to edit in place: it had never successfully applied anywhere.
-- 079_users_role_check_repair.sql applies the same corrected constraint, so
-- an existing database is repaired without re-running this file.

