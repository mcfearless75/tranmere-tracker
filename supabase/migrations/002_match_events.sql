-- Run in Supabase SQL Editor

-- Allow teacher role in users table
alter table public.users
  drop constraint if exists users_role_check;

alter table public.users
  add constraint users_role_check
  check (role in ('student', 'coach', 'teacher', 'admin'));

-- Match events created by coaches
create table if not exists match_events (
  id          uuid primary key default uuid_generate_v4(),
  coach_id    uuid not null references public.users(id),
  match_date  date not null,
  opponent    text not null,
  location    text,
  notes       text,
  status      text not null default 'upcoming'
                check (status in ('upcoming', 'completed', 'cancelled')),
  created_at  timestamptz default now()
);

-- Players invited to a match
create table if not exists match_squads (
  id            uuid primary key default uuid_generate_v4(),
  match_id      uuid not null references match_events(id) on delete cascade,
  player_id     uuid not null references public.users(id) on delete cascade,
  status        text not null default 'invited'
                  check (status in ('invited', 'accepted', 'declined')),
  position      text,
  coach_rating  int check (coach_rating between 1 and 10),
  coach_notes   text,
  created_at    timestamptz default now(),
  unique(match_id, player_id)
);

-- RLS policies
alter table match_events enable row level security;
alter table match_squads enable row level security;

-- Coaches and admins can manage match_events
create policy "staff can manage match_events"
  on match_events for all
  using (
    exists (
      select 1 from public.users
      where id = auth.uid()
      and role in ('admin', 'coach')
    )
  );

-- Players can read their own squad entries; coaches see all
create policy "players see own squad entries"
  on match_squads for select
  using (
    player_id = auth.uid()
    or exists (
      select 1 from public.users
      where id = auth.uid() and role in ('admin', 'coach')
    )
  );

create policy "staff manage squad entries"
  on match_squads for insert
  with check (
    exists (
      select 1 from public.users
      where id = auth.uid() and role in ('admin', 'coach')
    )
  );

create policy "staff update squad entries"
  on match_squads for update
  using (
    -- coaches update ratings; players update their own acceptance
    player_id = auth.uid()
    or exists (
      select 1 from public.users
      where id = auth.uid() and role in ('admin', 'coach')
    )
  );

create policy "staff delete squad entries"
  on match_squads for delete
  using (
    exists (
      select 1 from public.users
      where id = auth.uid() and role in ('admin', 'coach')
    )
  );
