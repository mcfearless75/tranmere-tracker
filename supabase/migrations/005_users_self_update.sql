-- Run in Supabase SQL Editor
-- Allow users to update their own profile row (course, avatar_url, name)

drop policy if exists "users can update own row" on public.users;

create policy "users can update own row"
  on public.users for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Also allow authenticated users to read their own row
drop policy if exists "users can read own row" on public.users;

create policy "users can read own row"
  on public.users for select
  using (auth.uid() = id);

-- And allow staff to read all user rows (for admin dashboards, match squads, etc)
drop policy if exists "staff can read all users" on public.users;

create policy "staff can read all users"
  on public.users for select
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role in ('admin','coach','teacher')
    )
  );
