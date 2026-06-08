-- Migration 028: Digital Learner Portfolio
-- Creates portfolio_entries table with RLS policies

create table if not exists public.portfolio_entries (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references auth.users(id) on delete cascade,
  title        text not null,
  description  text,
  entry_type   text not null default 'achievement',
  tags         text[] not null default '{}',
  media_url    text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Constrain entry_type to known values
alter table public.portfolio_entries
  add constraint portfolio_entries_entry_type_check
  check (entry_type in ('achievement', 'reflection', 'goal', 'evidence'));

-- Indexes
create index if not exists portfolio_entries_student_id_idx on public.portfolio_entries (student_id);
create index if not exists portfolio_entries_entry_type_idx on public.portfolio_entries (entry_type);

-- updated_at trigger
create or replace function public.set_portfolio_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger portfolio_entries_updated_at
  before update on public.portfolio_entries
  for each row execute function public.set_portfolio_updated_at();

-- Row Level Security
alter table public.portfolio_entries enable row level security;

-- Students can select their own entries
create policy "portfolio_entries_select_own"
  on public.portfolio_entries for select
  using (auth.uid() = student_id);

-- Students can insert their own entries
create policy "portfolio_entries_insert_own"
  on public.portfolio_entries for insert
  with check (auth.uid() = student_id);

-- Students can update their own entries
create policy "portfolio_entries_update_own"
  on public.portfolio_entries for update
  using (auth.uid() = student_id)
  with check (auth.uid() = student_id);

-- Students can delete their own entries
create policy "portfolio_entries_delete_own"
  on public.portfolio_entries for delete
  using (auth.uid() = student_id);
