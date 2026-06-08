-- Migration 023: Bi-weekly wellbeing surveys

create table public.wellbeing_surveys (
  id           uuid        primary key default gen_random_uuid(),
  student_id   uuid        not null references public.users(id) on delete cascade,
  sent_at      timestamptz not null default now(),
  completed_at timestamptz,
  status       text        not null default 'open' check (status in ('open', 'completed', 'expired')),
  created_at   timestamptz not null default now()
);

create table public.wellbeing_responses (
  id           uuid      primary key default gen_random_uuid(),
  survey_id    uuid      not null references public.wellbeing_surveys(id) on delete cascade,
  question_key text      not null,
  score        smallint  not null check (score between 1 and 5),
  note         text,
  created_at   timestamptz not null default now(),
  unique (survey_id, question_key)
);

create index on public.wellbeing_surveys(student_id);
create index on public.wellbeing_surveys(status);
create index on public.wellbeing_surveys(sent_at desc);

-- RLS
alter table public.wellbeing_surveys  enable row level security;
alter table public.wellbeing_responses enable row level security;

-- Students: see and write own surveys
create policy "students select own surveys"
  on public.wellbeing_surveys for select
  using (student_id = auth.uid());

create policy "students insert own surveys"
  on public.wellbeing_surveys for insert
  with check (student_id = auth.uid());

create policy "students update own surveys"
  on public.wellbeing_surveys for update
  using (student_id = auth.uid());

-- Students: write/read responses for their own surveys
create policy "students insert responses"
  on public.wellbeing_responses for insert
  with check (
    exists (
      select 1 from public.wellbeing_surveys
      where id = survey_id and student_id = auth.uid()
    )
  );

create policy "students select responses"
  on public.wellbeing_responses for select
  using (
    exists (
      select 1 from public.wellbeing_surveys
      where id = survey_id and student_id = auth.uid()
    )
  );

-- Admins: full access to everything
create policy "admins all surveys"
  on public.wellbeing_surveys for all
  using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

create policy "admins all responses"
  on public.wellbeing_responses for all
  using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );
