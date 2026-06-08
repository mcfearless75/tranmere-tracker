-- Migration 029: Goal setting with deadlines

create table public.student_goals (
  id           uuid        primary key default gen_random_uuid(),
  student_id   uuid        not null references auth.users(id) on delete cascade,
  title        text        not null,
  description  text,
  category     text        not null default 'personal' check (category in ('personal', 'academic', 'football', 'fitness')),
  deadline     date,
  priority     text        not null default 'medium' check (priority in ('low', 'medium', 'high')),
  status       text        not null default 'in_progress' check (status in ('in_progress', 'completed', 'abandoned')),
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index on public.student_goals(student_id);
create index on public.student_goals(status);
create index on public.student_goals(deadline);

-- RLS
alter table public.student_goals enable row level security;

-- Students: full CRUD on own goals
create policy "students select own goals"
  on public.student_goals for select
  using (auth.uid() = student_id);

create policy "students insert own goals"
  on public.student_goals for insert
  with check (auth.uid() = student_id);

create policy "students update own goals"
  on public.student_goals for update
  using (auth.uid() = student_id);

create policy "students delete own goals"
  on public.student_goals for delete
  using (auth.uid() = student_id);
