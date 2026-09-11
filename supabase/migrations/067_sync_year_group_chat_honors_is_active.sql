-- ============================================================================
-- 067_sync_year_group_chat_honors_is_active.sql
-- Run in Supabase Dashboard → SQL Editor
--
-- 2026-09-11: found while reconciling every "removed student still shows up
-- somewhere" instance after Adam O'Callaghan / Boyd Matheson turned up in the
-- match-events squad picker (both is_active = false, soft-hidden per
-- 053_users_is_active.sql). Same bug class, different table: the
-- sync_year_group_chat trigger (044_group_chat.sql) only fires on insert or
-- update of year_group/role, never is_active — so deactivating a student
-- (role and year_group both unchanged) never removes them from their
-- Year 1/2 Students chat. Confirmed live: 6 deactivated students, including
-- both named above, were still members of "Year 2 Students" at the time of
-- this migration.
--
-- Fix: the trigger now also fires on update of is_active, and treats
-- is_active = false exactly like "no longer a student" for sync-room
-- membership purposes — removed on deactivation, re-added automatically if
-- ever reactivated (since a no-op-ish update that flips is_active back to
-- true still re-runs the normal insert branch below).
--
-- Idempotent: safe to re-run.
-- ============================================================================

create or replace function public.sync_year_group_chat()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_room uuid;
  was_synced_member boolean;
begin
  was_synced_member := (tg_op = 'UPDATE' and old.role = 'student' and old.is_active is not false);

  if new.role <> 'student' or new.is_active is false then
    -- Only remove membership when actually transitioning OUT of an active
    -- student — never for a row that was already staff/inactive (staff
    -- membership here is manually seeded/managed, not trigger-owned, and
    -- must survive any unrelated update that merely names these columns in
    -- its SET list).
    if was_synced_member then
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
  after insert or update of year_group, role, is_active on public.users
  for each row execute function public.sync_year_group_chat();

-- One-off backfill: evict every currently-deactivated student who is stuck
-- in a year-group room from the historical gap above.
--
-- NOTE: unlike 044_group_chat.sql's year_group backfill, a no-op
-- "update ... set is_active = is_active" does NOT work here and was tried
-- first — for a row that's already inactive, OLD.is_active is already
-- false, so the trigger's own "was this actually a transition" guard
-- (`old.is_active is not false`) correctly refuses to treat it as a fresh
-- deactivation and does nothing. A direct one-off delete is required
-- instead; the trigger only needs to handle transitions from here on.
delete from chat_members
where user_id in (select id from public.users where role = 'student' and is_active = false)
and room_id in (select id from chat_rooms where sync_year_group is not null);
