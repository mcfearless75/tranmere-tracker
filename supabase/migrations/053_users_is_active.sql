-- ============================================================================
-- 053_users_is_active.sql
-- Run in Supabase Dashboard → SQL Editor
--
-- Roster reconciliation (2026-09-07): the live roster has 76 users but only
-- 60 (2 admin + 7 coach + 51 real students incl. Javan Mousa, who has no
-- account yet) belong on it. 16 student accounts don't match any name on
-- the current class roster — 6 with no course assigned (created in the very
-- first onboarding batch, 16 May) and 10 tagged to a "Level 2 Public
-- Services / Fitness" course (25 May) that isn't part of this roster.
--
-- Adds a reversible soft-hide flag rather than deleting anything — deleting
-- real auth accounts needs the FK audit described in CLAUDE.md first, and
-- "hide for now" implies this may be revisited. Actual login blocking is
-- done separately via GoTrue's admin ban (auth.admin.updateUserById with
-- ban_duration) — is_active alone does NOT stop someone from signing in,
-- it only controls whether the app treats them as part of the active roster
-- (admin Users list, attendance sweeps/reminders/reports).
--
-- To reverse for one user: UPDATE public.users SET is_active = true WHERE
-- id = '<id>'; then un-ban via the admin API (ban_duration: 'none').
--
-- Idempotent: safe to re-run.
-- ============================================================================

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.users.is_active IS
  'Soft-hide flag. false = excluded from admin Users list and attendance sweeps/reminders/reports, and (paired with a GoTrue admin ban) blocked from signing in. Never used as a delete substitute — flip back to true to fully reverse.';
