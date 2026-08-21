# Group Chat — Design

**Date:** 2026-08-21
**Status:** Approved, ready for implementation plan

## Problem

Chat today (`011_chat.sql`, `012_chat_bot.sql`, `app/chat/`) supports 1:1 DMs,
a personal AI-coach bot room, and a one-way admin broadcast. There is no way
to create a **named group** — e.g. "Year 1 Students", "Year 2 Students",
"Match Day Chat" — with a membership that can be changed over time. The
schema already anticipates this (`chat_rooms.kind` already allows `'squad'`
and `'custom'`; `chat_members` already has owner/admin/member roles and RLS
that lets staff add/remove members), but no UI or server action creates a
named multi-member room or manages its membership after creation.

## Scope decisions (from brainstorming)

- **Who creates/manages groups:** admin, coach, and teacher (all staff)
  equally — no "only the creator" restriction.
- **Membership pool:** students + staff only. Parents are not selectable —
  they keep using the existing parent portal/messages.
- **Year 1 / Year 2 Students:** two special rooms whose membership is
  **auto-synced** from each student's `users.year_group`, not manually
  curated. Staff cannot manually add/remove individuals from these two
  rooms; the roster always mirrors `year_group`.
- **Match Day Chat:** one persistent group, seeded at migration time,
  managed like any other manual group (staff add/remove players week to
  week) — not auto-created per fixture.
- **Leaving a group:** any member can leave a manual group, same as today's
  DM/bot leave behavior. The two auto-synced year-group rooms cannot be left
  by students — membership there is driven entirely by `year_group`, so a
  manual leave would just be undone (or drift) the next time the trigger
  fires.

## Architecture

No new tables. One additive column plus a sync trigger on the existing
`chat_rooms` / `chat_members` / `chat_messages` schema, and new server
actions + UI reusing the existing RLS policies from `011_chat.sql` (staff
can already insert/delete `chat_members` rows; members can already read/send
in rooms they belong to).

New migration `044_group_chat.sql`:

```sql
-- Marks a room's membership as auto-derived from users.year_group (1 or 2).
-- Null for every normal manually-managed room (DM, bot, broadcast, custom).
alter table chat_rooms
  add column if not exists sync_year_group smallint
  constraint chat_rooms_sync_year_group_check check (sync_year_group in (1, 2));

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
  other_room  uuid;
begin
  if new.role <> 'student' then
    -- Not a student (any more): remove from both year-group rooms.
    delete from chat_members
      where user_id = new.id
      and room_id in (select id from chat_rooms where sync_year_group is not null);
    return new;
  end if;

  select id into target_room from chat_rooms where sync_year_group = new.year_group;
  select id into other_room  from chat_rooms where sync_year_group is not null and sync_year_group <> new.year_group;

  if target_room is not null then
    insert into chat_members (room_id, user_id, role)
      values (target_room, new.id, 'member')
      on conflict (room_id, user_id) do nothing;
  end if;
  if other_room is not null then
    delete from chat_members where room_id = other_room and user_id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_year_group_chat_trigger on public.users;
create trigger sync_year_group_chat_trigger
  after insert or update of year_group, role on public.users
  for each row execute function public.sync_year_group_chat();

-- One-off backfill: sync every existing student into their current room.
update public.users set year_group = year_group where role = 'student';
```

The trigger is `security definer` and bypasses RLS by design — the same
pattern `bump_chat_room()` already uses in `011_chat.sql`. It only ever
touches the two rooms it owns (via `sync_year_group`); it never touches
`chat_members` rows in Match Day Chat or any DM.

## Server actions (`app/chat/actions.ts`, extended)

All four follow the existing `isRoomMember` / staff-role-check pattern
already used by `nudgeRoom` and `leaveOrDeleteRoom` — every check happens
server-side against the freshly-queried DB row, never against client state.

- **`createGroupChat(name: string, memberIds: string[])`** — staff-only
  (checked via `admin.from('users').select('role').eq('id', user.id)`).
  Inserts `chat_rooms(kind: 'custom', name, created_by: user.id)`, then
  `chat_members` for the creator (`role: 'owner'`) + every selected member
  (`role: 'member'`). Rejects empty name or empty member list.
- **`addGroupMembers(roomId: string, memberIds: string[])`** — staff-only.
  Rejects if the room is a `sync_year_group` room (returns
  `{ error: 'This roster is managed automatically' }`). Otherwise inserts
  `chat_members` rows for each id not already a member.
- **`removeGroupMember(roomId: string, userId: string)`** — staff-only.
  Same `sync_year_group` guard. Deletes the one `chat_members` row.
- **`leaveOrDeleteRoom` (existing, extended)** — add one guard at the top:
  if the room has `sync_year_group is not null`, return
  `{ error: "You can't leave this — ask a coach if this looks wrong" }`
  instead of proceeding. No change to its behavior for every other room
  kind.

## Frontend / UI

- **`app/chat/page.tsx`** (hub): add a **"New group"** button next to the
  existing "New message" button, staff-only (same `isStaff` check the page
  already computes for the DM directory). Opens `NewGroupPicker.tsx`.
- **`app/chat/NewGroupPicker.tsx`** (new, sibling to `NewDmPicker.tsx`): a
  name input + checkbox multi-select over the same staff/student directory
  the hub already loads (parents excluded — the directory query already
  restricts non-staff viewers to `coach/teacher/admin/student`; the
  staff-viewer branch is narrowed here to exclude `parent`). Submits to
  `createGroupChat`, then routes to the new room.
- **`app/chat/[roomId]/GroupMembers.tsx`** (new): member list shown on the
  room page for any `kind: 'custom'` room with more than 2 members. Staff
  viewing a manual group see inline "add" (opens the same checkbox picker,
  filtered to non-members) and "remove" (×) controls per row. Viewing a
  `sync_year_group` room instead shows a small "Auto-synced roster" badge
  and no controls, staff included.
- **`app/chat/page.tsx`** room list rendering: no change needed — `kind`
  already falls back to `room.name` for the label, and `'custom'` rooms
  already render with the generic member-count subtitle
  (`app/chat/[roomId]/page.tsx:68`).
- **`ChatRoomActions.tsx`** (existing): pass a new `canLeave` prop
  (`!room.sync_year_group || !isStudentRole`) down from the room page; hide
  the "Leave conversation" menu item when `canLeave` is false instead of
  relying solely on the server-side guard (defense in depth — same
  belt-and-braces pattern the rest of this app uses for staff-only UI).

## Testing

Matches the existing convention: this codebase's Jest coverage lives on
`lib/` pure functions and `components/`, not on server actions/API routes
(see the calendar design's note on this — zero existing route/action
coverage). This design follows that:

- New tests for `NewGroupPicker` (renders directory, excludes parents,
  disables submit with no name/no members selected).
- New tests for `GroupMembers` (renders add/remove controls for manual
  groups, renders the "Auto-synced roster" badge with no controls for
  `sync_year_group` rooms).
- `createGroupChat` / `addGroupMembers` / `removeGroupMember` /
  `leaveOrDeleteRoom`'s new guard stay server actions and stay untested by
  Jest, consistent with `nudgeRoom`/`leaveOrDeleteRoom` today — verified
  live post-deploy the way the rest of the chat/push work has been.

## Out of scope (deliberately)

- Parents as group chat members.
- Per-fixture auto-created match chats (one persistent Match Day Chat only,
  per approved design).
- Group avatars / custom icons.
- Promoting a member to `chat_members.role = 'admin'` within a group (the
  column already supports it; no UI surfaces it yet — same as today).
- A generic "manage any room's membership" screen for DMs/bot rooms — this
  design only adds membership management for `kind: 'custom'` groups.
