-- Run in Supabase SQL Editor — safe to re-run any time
-- Fixes "infinite recursion detected in policy for relation users" error.

-- Drop ALL prior policies (both old and new names) so this is idempotent
drop policy if exists "staff can read all users" on public.users;
drop policy if exists "users can read own row" on public.users;
drop policy if exists "users can update own row" on public.users;
drop policy if exists "staff can manage match_events" on match_events;
drop policy if exists "staff manage squad entries" on match_squads;
drop policy if exists "staff update squad entries" on match_squads;
drop policy if exists "staff delete squad entries" on match_squads;
drop policy if exists "staff manage squad entries insert" on match_squads;
drop policy if exists "staff manage squad entries update" on match_squads;
drop policy if exists "staff manage squad entries delete" on match_squads;
drop policy if exists "players see own squad entries" on match_squads;
drop policy if exists "staff manage gps_sessions" on gps_sessions;
drop policy if exists "students view own gps" on gps_sessions;

-- Helper function (SECURITY DEFINER bypasses RLS inside it → no recursion)
create or replace function public.is_staff()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid()
    and role in ('admin', 'coach', 'teacher')
  );
$$;

-- Users table policies
create policy "users can read own row" on public.users
  for select using (auth.uid() = id);

create policy "users can update own row" on public.users
  for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "staff can read all users" on public.users
  for select using (public.is_staff());

-- Match events
create policy "staff can manage match_events" on match_events
  for all using (public.is_staff());

-- Match squads
create policy "players see own squad entries" on match_squads
  for select using (player_id = auth.uid() or public.is_staff());

create policy "staff manage squad entries insert" on match_squads
  for insert with check (public.is_staff());

create policy "staff manage squad entries update" on match_squads
  for update using (player_id = auth.uid() or public.is_staff());

create policy "staff manage squad entries delete" on match_squads
  for delete using (public.is_staff());

-- GPS sessions
create policy "staff manage gps_sessions" on gps_sessions
  for all using (public.is_staff());

create policy "students view own gps" on gps_sessions
  for select using (player_id = auth.uid());
