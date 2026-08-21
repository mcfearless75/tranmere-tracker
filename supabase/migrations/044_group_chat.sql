-- 044_group_chat.sql
-- Group chat: named multi-member rooms with editable membership, on top of
-- the existing chat_rooms/chat_members schema (011_chat.sql).
-- Run in Supabase SQL Editor.

-- 012_chat_bot.sql dropped 'custom' from chat_rooms_kind_check when it added
-- 'bot' (011_chat.sql originally allowed it). Restore it — every room this
-- migration creates uses kind = 'custom'.
alter table chat_rooms
  drop constraint if exists chat_rooms_kind_check;
alter table chat_rooms
  add constraint chat_rooms_kind_check
  check (kind in ('dm','squad','match','broadcast','bot','custom'));

-- Marks a room's membership as auto-derived from users.year_group (1 or 2).
-- Null for every normal manually-managed room (DM, bot, broadcast, custom).
alter table chat_rooms
  add column if not exists sync_year_group smallint;

alter table chat_rooms
  drop constraint if exists chat_rooms_sync_year_group_check;
alter table chat_rooms
  add constraint chat_rooms_sync_year_group_check check (sync_year_group in (1, 2));

create unique index if not exists chat_rooms_sync_year_group_unique
  on chat_rooms(sync_year_group) where sync_year_group is not null;

-- Seed the two auto-synced rooms + one manual "Match Day Chat" group.
-- created_by left null (system-seeded, not owned by any one staff member).
insert into chat_rooms (kind, name, sync_year_group)
  select 'custom', 'Year 1 Students', 1
  where not exists (select 1 from chat_rooms where sync_year_group = 1);
insert into chat_rooms (kind, name, sync_year_group)
  select 'custom', 'Year 2 Students', 2
  where not exists (select 1 from chat_rooms where sync_year_group = 2);
insert into chat_rooms (kind, name)
  select 'custom', 'Match Day Chat'
  where not exists (select 1 from chat_rooms where name = 'Match Day Chat' and kind = 'custom');

-- Seed every current staff member into both year-group rooms so they can
-- read, post, and moderate. This seed is durable because the trigger below
-- only ever removes someone who is *transitioning out of* the student role
-- (old.role = 'student' and new.role <> 'student') — it never touches a
-- row that was already staff, so a staff role edit (e.g. coach -> admin)
-- cannot silently evict them. New staff hired after this migration runs
-- are not auto-added; add them via the group's "Add people" control.
insert into chat_members (room_id, user_id, role)
  select r.id, u.id, 'member'
  from chat_rooms r
  cross join public.users u
  where r.sync_year_group is not null
  and u.role in ('admin', 'coach', 'teacher')
  on conflict (room_id, user_id) do nothing;

-- Keep the two year-group rooms' chat_members in lockstep with
-- users.year_group. Fires on insert (new student) and on update of
-- year_group/role (promotion, or role changing away from/to student).
create or replace function public.sync_year_group_chat()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_room uuid;
begin
  if new.role <> 'student' then
    -- Only remove membership when actually transitioning OUT of student —
    -- never for a row that was already non-student (staff membership here
    -- is manually seeded/managed, not trigger-owned, and must survive any
    -- unrelated update that merely names role/year_group in its SET list).
    if tg_op = 'update' and old.role = 'student' then
      delete from chat_members
        where user_id = new.id
        and room_id in (select id from chat_rooms where sync_year_group is not null);
    end if;
    return new;
  end if;

  select id into target_room from chat_rooms where sync_year_group = new.year_group;

  if target_room is not null then
    insert into chat_members (room_id, user_id, role)
      values (target_room, new.id, 'member')
      on conflict (room_id, user_id) do nothing;
  end if;

  -- Remove from every OTHER year-group room (set-based — doesn't assume
  -- exactly two synced rooms exist, unlike a scalar "other room" lookup).
  delete from chat_members
    where user_id = new.id
    and room_id in (
      select id from chat_rooms
      where sync_year_group is not null and sync_year_group is distinct from new.year_group
    );

  return new;
end;
$$;

drop trigger if exists sync_year_group_chat_trigger on public.users;
create trigger sync_year_group_chat_trigger
  after insert or update of year_group, role on public.users
  for each row execute function public.sync_year_group_chat();

-- One-off backfill: sync every existing student into their current room.
-- A no-op write to year_group re-fires the trigger via "update of year_group".
update public.users set year_group = year_group where role = 'student';

-- Block direct client-side self-insert into the auto-synced year-group
-- rooms — that roster is trigger-managed only. Staff-driven adds go
-- through addGroupMembers(), which uses the service-role admin client and
-- bypasses RLS entirely, so this only closes the direct-client path.
--
-- security definer, not an inline subquery: a plain "not exists (select 1
-- from chat_rooms ...)" inside the policy expression runs as the inserting
-- user, so chat_rooms' own SELECT policy (is_chat_member(id) or is_staff())
-- would hide the target room from anyone not already a member of it —
-- exactly the student trying to self-join a year-group room they're NOT
-- in. A security definer helper (matching the is_chat_member() pattern
-- above) bypasses that and sees the real row.
create or replace function public.is_synced_room(rid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from chat_rooms where id = rid and sync_year_group is not null);
$$;

drop policy if exists "add self or staff adds" on chat_members;
create policy "add self or staff adds" on chat_members
  for insert with check (
    (user_id = auth.uid() or public.is_staff())
    and not public.is_synced_room(room_id)
  );
