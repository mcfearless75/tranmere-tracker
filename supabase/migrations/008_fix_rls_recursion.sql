-- Run in Supabase SQL Editor
-- Fixes "infinite recursion detected in policy for relation users" error.
-- The recursive policy from 005 queried public.users from within a policy ON
-- public.users, which triggered itself. Replace with a SECURITY DEFINER
-- function that runs with owner privileges (bypassing RLS inside it).

-- Drop the recursive policies
drop policy if exists "staff can read all users" on public.users;
drop policy if exists "staff can manage match_events" on match_events;
drop policy if exists "staff manage squad entries" on match_squads;
drop policy if exists "staff update squad entries" on match_squads;
drop policy if exists "staff delete squad entries" on match_squads;
drop policy if exists "staff manage gps_sessions" on gps_sessions;

-- Helper: is the current user staff? (SECURITY DEFINER avoids RLS recursion)
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

-- Re-create policies using the helper
create policy "staff can read all users"
  on public.users for select
  using (public.is_staff());

create policy "staff can manage match_events"
  on match_events for all
  using (public.is_staff());

create policy "staff manage squad entries insert"
  on match_squads for insert
  with check (public.is_staff());

create policy "staff manage squad entries update"
  on match_squads for update
  using (player_id = auth.uid() or public.is_staff());

create policy "staff manage squad entries delete"
  on match_squads for delete
  using (public.is_staff());

create policy "staff manage gps_sessions"
  on gps_sessions for all
  using (public.is_staff());
