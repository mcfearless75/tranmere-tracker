-- ============================================================================
-- 069_match_events_kick_off_time.sql
-- Run in Supabase Dashboard → SQL Editor
--
-- 2026-09-14: adds a dedicated kick-off time field to match_events. Staff
-- have been typing the kick-off time into the free-text Notes field as a
-- workaround — this gives it a real column instead.
--
-- Deliberately a plain nullable `time` column alongside the existing
-- `match_date` (a `date` with no time component), rather than replacing
-- match_date with a single timestamptz — keeps every existing match_date
-- query/filter/index working unchanged. Existing rows get kick_off_time =
-- NULL; every display site must treat that as "no time set", not an error.
--
-- Idempotent: safe to re-run.
-- ============================================================================

alter table public.match_events
  add column if not exists kick_off_time time;

comment on column public.match_events.kick_off_time is
  'Optional kick-off time of day for the match. NULL means no time was set (pre-existing matches, or staff who left it blank). Paired with match_date, which stays a plain date.';
