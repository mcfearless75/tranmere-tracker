create table if not exists public.idp_plans (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  target_date date,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idp_plans_student_id_idx on public.idp_plans(student_id);
alter table public.idp_plans enable row level security;
create policy "Students manage own idp plans" on public.idp_plans
  for all using (auth.uid() = student_id) with check (auth.uid() = student_id);
