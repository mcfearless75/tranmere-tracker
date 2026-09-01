-- 046_timetable.sql
-- Run in Supabase Dashboard → SQL Editor (or via the Supabase MCP apply_migration tool)
--
-- 1st-year weekly academic timetable (from the college Moodle eILP dashboard).
-- Recurring weekly template — admin edits it in place, no per-week rows.
-- Wednesdays are match day: day_of_week deliberately excludes 3 at the DB
-- level, not just in the UI.

create table if not exists timetable_slots (
  id          uuid primary key default uuid_generate_v4(),
  year_group  smallint not null default 1 check (year_group in (1, 2)),
  day_of_week smallint not null check (day_of_week in (1, 2, 4, 5)), -- Mon,Tue,Thu,Fri (0=Sun..6=Sat convention; 3=Wed excluded, match day)
  start_time  time not null,
  end_time    time not null check (end_time > start_time),
  title       text not null,
  location    text,
  tutor       text,
  created_by  uuid not null references public.users(id),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

alter table timetable_slots enable row level security;

-- Staff manage (all commands) — matches calendar_events' pattern
create policy "staff can manage timetable_slots"
  on timetable_slots for all
  using (public.is_staff());

-- Students can only read their own year group's timetable
create policy "students read own year group timetable_slots"
  on timetable_slots for select
  to authenticated
  using (
    exists (
      select 1 from public.users
      where users.id = auth.uid()
        and users.role = 'student'
        and users.year_group = timetable_slots.year_group
    )
  );

-- Idempotency log for the reminder cron (app/api/cron/timetable-reminders).
-- Recurring slots have no per-date row of their own, so this is what stops
-- the every-5-minutes cron from double-sending for the same slot on the same
-- day if two invocations ever overlap.
create table if not exists timetable_reminder_log (
  slot_id      uuid not null references timetable_slots(id) on delete cascade,
  session_date date not null,
  sent_at      timestamptz default now(),
  primary key (slot_id, session_date)
);

alter table timetable_reminder_log enable row level security;

-- Staff-only — this is an internal cron bookkeeping table, not
-- student-facing. The cron itself uses the service-role client, which
-- bypasses RLS entirely.
create policy "staff can manage timetable_reminder_log"
  on timetable_reminder_log for all
  using (public.is_staff());
