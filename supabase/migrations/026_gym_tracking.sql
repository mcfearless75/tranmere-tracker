create table if not exists public.gym_logs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.users(id) on delete cascade not null,
  logged_at timestamptz default now() not null,
  logged_date date not null default current_date,
  exercise text not null,
  sets integer,
  reps integer,
  weight_kg numeric(5,2),
  notes text
);
alter table public.gym_logs enable row level security;
create policy "students own gym logs" on public.gym_logs
  for all using (auth.uid() = student_id);
