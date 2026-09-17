alter table public.match_events
  add column if not exists meet_time time;

create table if not exists public.wellbeing_staff_notes (
  id          uuid primary key default uuid_generate_v4(),
  survey_id   uuid not null references public.wellbeing_surveys(id) on delete cascade,
  student_id  uuid references public.users(id) on delete set null,
  staff_id    uuid references public.users(id) on delete set null,
  body        text not null,
  completed   boolean not null default false,
  created_at  timestamptz default now()
);

create index if not exists wellbeing_staff_notes_survey_idx
  on public.wellbeing_staff_notes (survey_id, created_at);

alter table public.wellbeing_staff_notes enable row level security;

drop policy if exists "staff manage wellbeing notes" on public.wellbeing_staff_notes;
create policy "staff manage wellbeing notes"
  on public.wellbeing_staff_notes for all
  using (public.is_staff())
  with check (public.is_staff());
