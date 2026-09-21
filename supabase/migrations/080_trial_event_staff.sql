-- Renamed from 040_trial_event_staff.sql on 2026-09-21. The 040 slot was
-- already taken by 040_lunch_phase.sql, and the migration runner keys on the
-- numeric prefix — so on a fresh replay only one of the two ever ran, and
-- this was the one that lost. It had never been applied to production
-- either, while four app files under app/api/recruitment/trials/ query the
-- table, so "assign staff to trial events" (5b12e2e) was broken live.
-- Nothing else references trial_event_staff, so moving it to the end is
-- dependency-safe; it only needs trial_events (034_recruitment).
-- The policy drop below was added at the same time to make this re-runnable.

-- Staff assigned to a trial event, so they can be listed and notified.
create table if not exists public.trial_event_staff (
  trial_event_id uuid not null references public.trial_events(id) on delete cascade,
  user_id        uuid not null references public.users(id) on delete cascade,
  created_at     timestamptz default now(),
  primary key (trial_event_id, user_id)
);

create index if not exists trial_event_staff_user_id_idx
  on public.trial_event_staff (user_id);

alter table public.trial_event_staff enable row level security;

drop policy if exists "staff all trial event staff" on public.trial_event_staff;
create policy "staff all trial event staff"
  on public.trial_event_staff for all
  using (is_staff())
  with check (is_staff());
