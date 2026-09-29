-- ============================================================================
-- 089_multi_team_membership.sql
-- Run in Supabase Dashboard → SQL Editor. Safe to re-run.
--
-- 2026-09-29: coaches asked to put a player in more than one squad (e.g. a
-- White player who also trains/plays with Prem), and to have each squad's chat
-- follow its roster. 084 deliberately allowed one team per player via the
-- single users.team_id column; this lifts that.
--
-- Model:
--   team_members (team_id, user_id)  — every team a player is in. Source of truth.
--   users.team_id                     — kept as the player's MAIN team: the badge,
--                                       and the eligibility filter in
--                                       lib/teams/players.ts. Triggers below keep
--                                       it pointing at one of their memberships,
--                                       or NULL when they have none.
--   chat_rooms.sync_team_id           — a squad chat whose player membership is
--                                       derived from team_members.
--
-- Legacy writers of users.team_id (the user edit page, student identity form)
-- keep "move" semantics: changing someone's main team from A to B drops their
-- A membership and adds B. Extra teams are only added via team_members.
--
-- FKs are ON DELETE CASCADE both ways — deleting a user or a team removes the
-- membership rows and nothing else (see the mass-deletion rule in CLAUDE.md).
-- ============================================================================

create table if not exists public.team_members (
  team_id    uuid not null references public.teams(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

create index if not exists team_members_user_id_idx on public.team_members (user_id);

alter table public.team_members enable row level security;

drop policy if exists "staff manage team members" on public.team_members;
create policy "staff manage team members" on public.team_members
  for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists "authenticated read team members" on public.team_members;
create policy "authenticated read team members" on public.team_members
  for select using (auth.uid() is not null);

-- Backfill from the single column.
insert into public.team_members (team_id, user_id)
  select team_id, id from public.users where team_id is not null
  on conflict do nothing;

-- ── Squad chats ─────────────────────────────────────────────────────────────
alter table public.chat_rooms
  add column if not exists sync_team_id uuid references public.teams(id) on delete set null;

create unique index if not exists chat_rooms_sync_team_id_unique
  on public.chat_rooms (sync_team_id) where sync_team_id is not null;

-- ── team_members → users.team_id + squad chat ───────────────────────────────
create or replace function public.team_members_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  u public.users%rowtype;
begin
  if tg_op = 'INSERT' then
    select * into u from public.users where id = new.user_id;

    -- First team becomes the main team.
    update public.users set team_id = new.team_id
      where id = new.user_id and team_id is null;

    if u.is_active is not false then
      insert into public.chat_members (room_id, user_id, role)
        select r.id, new.user_id, 'member'
        from public.chat_rooms r
        where r.sync_team_id = new.team_id
        on conflict (room_id, user_id) do nothing;
    end if;
    return new;
  end if;

  -- DELETE
  select * into u from public.users where id = old.user_id;
  if not found then return old; end if;  -- user row itself being deleted

  -- Main team removed → fall back to their oldest remaining team, or NULL.
  if u.team_id = old.team_id then
    update public.users set team_id = (
      select tm.team_id from public.team_members tm
      where tm.user_id = old.user_id
      order by tm.created_at, tm.team_id
      limit 1
    ) where id = old.user_id;
  end if;

  -- Staff in a squad chat were added as staff (at chat creation or by hand),
  -- not as players, so leaving a team never evicts them from its chat.
  if u.role not in ('admin', 'coach', 'teacher') then
    delete from public.chat_members
      where user_id = old.user_id
      and room_id in (select id from public.chat_rooms where sync_team_id = old.team_id);
  end if;
  return old;
end;
$$;

drop trigger if exists team_members_sync_trigger on public.team_members;
create trigger team_members_sync_trigger
  after insert or delete on public.team_members
  for each row execute function public.team_members_sync();

-- ── users.team_id / is_active → team_members + squad chat ───────────────────
create or replace function public.users_team_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Main team changed by a legacy single-team writer: treat as a move.
  if tg_op = 'UPDATE' and new.team_id is distinct from old.team_id then
    if new.team_id is not null then
      insert into public.team_members (team_id, user_id)
        values (new.team_id, new.id)
        on conflict do nothing;
    end if;
    if old.team_id is not null then
      -- Only a move, not a fallback: team_members_sync sets team_id itself
      -- when a membership is deleted, and by then old.team_id's row is gone.
      delete from public.team_members
        where team_id = old.team_id and user_id = new.id;
    end if;
  elsif tg_op = 'INSERT' and new.team_id is not null then
    insert into public.team_members (team_id, user_id)
      values (new.team_id, new.id)
      on conflict do nothing;
  end if;

  -- Deactivated players leave their squad chats; reactivated ones rejoin.
  if tg_op = 'UPDATE' and new.is_active is distinct from old.is_active
     and new.role not in ('admin', 'coach', 'teacher') then
    if new.is_active is false then
      delete from public.chat_members
        where user_id = new.id
        and room_id in (select id from public.chat_rooms where sync_team_id is not null);
    else
      insert into public.chat_members (room_id, user_id, role)
        select r.id, new.id, 'member'
        from public.chat_rooms r
        join public.team_members tm on tm.team_id = r.sync_team_id
        where tm.user_id = new.id
        on conflict (room_id, user_id) do nothing;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists users_team_sync_trigger on public.users;
create trigger users_team_sync_trigger
  after insert or update of team_id, is_active on public.users
  for each row execute function public.users_team_sync();
