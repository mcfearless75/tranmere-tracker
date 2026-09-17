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

create policy "staff all trial event staff"
  on public.trial_event_staff for all
  using (is_staff())
  with check (is_staff());
