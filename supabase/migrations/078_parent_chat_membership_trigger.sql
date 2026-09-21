-- ============================================================================
-- 078_parent_chat_membership_trigger.sql
-- Run in Supabase Dashboard → SQL Editor
--
-- 2026-09-21: 077_parent_chat.sql seeded the "Parents" room with every
-- then-existing parent AND staff member (admin/coach/teacher) via a one-shot
-- `insert ... select`. Nothing has maintained that membership since:
--
--   * app/api/admin/invite-parent/route.ts DOES add the new parent (and
--     lazily creates the room), so the parent path was already covered;
--   * app/api/admin/create-user/route.ts — the route behind Admin → Users,
--     and the ONLY way a coach/teacher/admin is created — never touches chat
--     at all. Same for app/api/lti/launch/route.ts.
--
-- So every staff member hired after 077 ran would silently never be in the
-- Parents room and would never see parent messages, while every earlier
-- colleague was — the same "two states drift apart" class of bug as
-- 067 (year-group chat vs is_active) and 068 (RLS helpers vs is_active).
-- Verified before writing this: 11 of 11 eligible users are currently
-- members, so nothing is broken yet — the gap only bites on the next staff
-- account created.
--
-- Fix: let the database own the membership, exactly as sync_year_group_chat
-- already owns the Year 1/2 rosters, rather than asking three separate code
-- paths to remember the rule.
--
-- Idempotent: safe to re-run.
-- ============================================================================

-- The trigger looks the room up by kind alone, so guarantee there can only
-- ever be one. Mirrors chat_rooms_sync_year_group_unique in 044.
-- Verified exactly one kind = 'parent' room exists, so this cannot fail here.
create unique index if not exists chat_rooms_parent_unique
  on public.chat_rooms(kind) where kind = 'parent';

create or replace function public.sync_parent_chat()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_room  uuid;
  is_eligible  boolean;
  was_eligible boolean;
begin
  -- Matches 077's seed predicate exactly: staff and parents, excluding
  -- deactivated accounts. `is not false` (rather than `= true`) keeps a NULL
  -- is_active eligible, same as 077's `is distinct from false`.
  is_eligible := new.role in ('admin', 'coach', 'teacher', 'parent')
                 and new.is_active is not false;

  was_eligible := tg_op = 'UPDATE'
                  and old.role in ('admin', 'coach', 'teacher', 'parent')
                  and old.is_active is not false;

  select id into target_room from chat_rooms where kind = 'parent';

  -- invite-parent creates the room lazily, so it legitimately may not exist
  -- yet on a fresh database. Nothing to sync until it does.
  if target_room is null then
    return new;
  end if;

  if is_eligible then
    insert into chat_members (room_id, user_id, role)
      values (target_room, new.id, 'member')
      on conflict (room_id, user_id) do nothing;
  elsif was_eligible then
    -- Only remove on an actual transition OUT of eligibility — never for a
    -- row that was already ineligible, so an unrelated update that merely
    -- names role/is_active in its SET list cannot evict anyone. Same guard,
    -- and same reasoning, as sync_year_group_chat in 067.
    delete from chat_members
      where room_id = target_room and user_id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_parent_chat_trigger on public.users;
create trigger sync_parent_chat_trigger
  after insert or update of role, is_active on public.users
  for each row execute function public.sync_parent_chat();

-- Backfill anyone eligible who is not a member (no-op today — 077's seed is
-- still complete — but makes this migration self-sufficient on any database
-- where 077 ran before a later account was created).
insert into chat_members (room_id, user_id, role)
select r.id, u.id, 'member'
from chat_rooms r
cross join public.users u
where r.kind = 'parent'
  and u.role in ('admin', 'coach', 'teacher', 'parent')
  and u.is_active is not false
on conflict (room_id, user_id) do nothing;

-- And evict anyone no longer eligible. A no-op update cannot do this job:
-- for a row that is ALREADY ineligible the trigger's transition guard above
-- correctly declines to act, so a direct delete is required — the same
-- lesson 067 recorded after trying the no-op-update approach first.
-- Verified to match 0 rows at the time of writing.
delete from chat_members cm
using chat_rooms r, public.users u
where cm.room_id = r.id
  and cm.user_id = u.id
  and r.kind = 'parent'
  and (u.role not in ('admin', 'coach', 'teacher', 'parent') or u.is_active is false);
