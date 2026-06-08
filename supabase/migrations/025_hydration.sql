create table if not exists public.hydration_logs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.users(id) on delete cascade not null,
  logged_at timestamptz default now() not null,
  amount_ml integer not null check (amount_ml > 0),
  logged_date date not null default current_date
);
alter table public.hydration_logs enable row level security;
create policy "students own hydration" on public.hydration_logs
  for all using (auth.uid() = student_id);
