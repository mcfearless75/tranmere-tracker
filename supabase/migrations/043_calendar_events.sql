-- 043_calendar_events.sql
-- Run in Supabase Dashboard → SQL Editor (or via the Supabase MCP apply_migration tool)
--
-- Global calendar: admin/coach/teacher add one-off events (trips, parents'
-- evenings, kit collection days) that every role sees. reminder_sent_at is
-- an idempotency marker so the day-before reminder cron (see
-- app/api/cron/calendar-reminders) can never double-send for the same event,
-- even across its two DST-safe scheduled invocations.

create table if not exists calendar_events (
  id                uuid primary key default uuid_generate_v4(),
  title             text not null,
  event_date        date not null,
  event_time        time,
  description       text,
  created_by        uuid not null references public.users(id),
  created_at        timestamptz default now(),
  updated_at        timestamptz default now(),
  reminder_sent_at  timestamptz
);

alter table calendar_events enable row level security;

-- Staff manage (all commands) — matches match_events' pattern
create policy "staff can manage calendar_events"
  on calendar_events for all
  using (public.is_staff());

-- Everyone (authenticated) can read — non-sensitive academy info, every role sees it.
-- `to authenticated` is required: without it, Supabase's default grants also let
-- the `anon` role read via the REST API (the anon key ships in the client bundle).
create policy "everyone can read calendar_events"
  on calendar_events for select
  to authenticated
  using (true);

-- Verification (run separately):
--
-- 1. Table + RLS enabled (should return 1 row, rowsecurity = true):
--   SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'calendar_events';
--
-- 2. Both policies exist (should return 2 rows):
--   SELECT policyname, cmd FROM pg_policies WHERE tablename = 'calendar_events';
