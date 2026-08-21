# Group Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let staff (admin/coach/teacher) create named group chats with editable membership, on top of the existing `chat_rooms`/`chat_members`/`chat_messages` schema — including two auto-synced "Year 1/Year 2 Students" rosters and a manually-managed "Match Day Chat".

**Architecture:** No new tables. One additive `chat_rooms.sync_year_group` column + a `security definer` trigger on `public.users` keep the two year-group rooms' membership in lockstep with each student's `year_group`. New server actions (`createGroupChat`, `addGroupMembers`, `removeGroupMember`) and a guard added to the existing `leaveOrDeleteRoom` reuse the RLS policies `011_chat.sql` already defines — no policy changes needed. New UI: a "New group" picker on the chat hub, and a member list + add/remove controls on the room page for `kind: 'custom'` rooms.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase (`@supabase/ssr` + admin client), Tailwind, Jest + Testing Library.

## Global Constraints

- Use `.maybeSingle()` for any Supabase lookup that may legitimately return no row (per `CLAUDE.md`) — every new staff-role check in this plan uses it.
- Server actions must re-verify the caller's role/membership against the DB on every call — never trust client-supplied booleans. Matches the existing pattern in `nudgeRoom`/`leaveOrDeleteRoom`.
- New group-chat components live alongside the existing chat components in `app/chat/` and `app/chat/[roomId]/` (not the shared `components/` directory) — this codebase's chat feature already keeps its components co-located there (`NewDmPicker.tsx`, `ChatRoomActions.tsx`, `ChatThread.tsx`), and this plan follows that established pattern rather than the general "components go in `components/`" rule.
- No new tables. One migration file, `supabase/migrations/044_group_chat.sql`, following the existing numbering convention.
- Parents are excluded from every group-chat membership picker (creation and add-members) — group chats are students + staff only per the approved design.
- Jest coverage targets React components only, matching this codebase's existing convention (zero API-route/server-action Jest coverage anywhere today — see `docs/superpowers/specs/2026-08-20-global-calendar-design.md`'s Testing section). Server actions and the migration are verified by manual/live testing, not Jest.
- The migration file is **not** applied automatically by any task in this plan — per this project's existing convention, every migration file in `supabase/migrations/` is written and committed, then run manually in the Supabase SQL Editor by a human. The final task calls this out explicitly.

---

### Task 1: Migration — auto-synced year-group rooms + Match Day Chat seed

**Files:**
- Create: `supabase/migrations/044_group_chat.sql`

**Interfaces:**
- Produces: `chat_rooms.sync_year_group` column (nullable smallint, 1 or 2), used by every later task to distinguish an auto-synced room from a manually-managed one. Produces the `public.sync_year_group_chat()` trigger function and `sync_year_group_chat_trigger` on `public.users`. Seeds three rooms: `'Year 1 Students'`, `'Year 2 Students'` (both `kind: 'custom'`), and `'Match Day Chat'` (`kind: 'custom'`, `sync_year_group: null`).

- [ ] **Step 1: Write the migration file**

```sql
-- 044_group_chat.sql
-- Group chat: named multi-member rooms with editable membership, on top of
-- the existing chat_rooms/chat_members schema (011_chat.sql).
-- Run in Supabase SQL Editor.

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
-- A no-op write to year_group re-fires the trigger via "update of year_group".
update public.users set year_group = year_group where role = 'student';
```

- [ ] **Step 2: Self-check the SQL against `011_chat.sql`'s existing conventions**

Read `supabase/migrations/011_chat.sql` (already in this repo) side by side
with the new file and confirm:
- `chat_rooms.kind` already allows `'custom'` — no constraint change needed
  for the `kind` column itself.
- `chat_members` primary key is `(room_id, user_id)` — the trigger's
  `on conflict (room_id, user_id) do nothing` matches that exactly.
- The `security definer` + `set search_path = public` pattern matches
  `public.is_chat_member()` and `public.bump_chat_room()` in `011_chat.sql`.

No automated test is possible for a migration file in this repo (no
existing migration has Jest coverage) — this step is the verification.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/044_group_chat.sql
git commit -m "feat: add group chat migration (sync_year_group + trigger + seed rooms)"
```

Do **not** run this migration against Supabase yet — Task 7 covers running
it, after every other task's code has landed, so the app code and schema
change ship together.

---

### Task 2: Server actions — create/add/remove group members, guard leave

**Files:**
- Modify: `app/chat/actions.ts`

**Interfaces:**
- Consumes: `createAdminClient()`, `createClient()` from `@/lib/supabase/*`
  (already imported in this file); `SupabaseClient` type (already imported).
- Produces:
  - `createGroupChat(name: string, memberIds: string[]): Promise<string | { error: string }>`
  - `addGroupMembers(roomId: string, memberIds: string[]): Promise<{ ok: boolean; error?: string }>`
  - `removeGroupMember(roomId: string, userId: string): Promise<{ ok: boolean; error?: string }>`
  - `isSyncedRoom(admin: SupabaseClient, roomId: string): Promise<boolean>` (module-private helper, used by the three functions above and by the `leaveOrDeleteRoom` guard)

  These four are consumed directly by Task 3 (`NewGroupPicker`), Task 5
  (`GroupMembers`), and Task 6 (`AddGroupMembers`).

- [ ] **Step 1: Add the `isSyncedRoom` helper and `createGroupChat`, right after the existing `isRoomMember` helper**

Open `app/chat/actions.ts`. Directly below the existing `isRoomMember`
function (ends at line 17), insert:

```ts
/** True if the room's membership is auto-derived from year_group (not manually editable). */
async function isSyncedRoom(admin: SupabaseClient, roomId: string): Promise<boolean> {
  const { data } = await admin
    .from('chat_rooms')
    .select('sync_year_group')
    .eq('id', roomId)
    .maybeSingle()
  return !!data?.sync_year_group
}

/** Create a new named group chat. Staff-only (admin/coach/teacher). */
export async function createGroupChat(name: string, memberIds: string[]): Promise<string | { error: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const admin = createAdminClient()
  const { data: me } = await admin.from('users').select('role').eq('id', user.id).maybeSingle()
  if (!me || !['admin', 'coach', 'teacher'].includes(me.role)) return { error: 'Staff only' }

  const trimmedName = name.trim()
  if (!trimmedName) return { error: 'Group needs a name' }

  const uniqueMemberIds = Array.from(new Set(memberIds.filter(id => id !== user.id)))
  if (uniqueMemberIds.length === 0) return { error: 'Pick at least one member' }

  const { data: room, error } = await admin
    .from('chat_rooms')
    .insert({ kind: 'custom', name: trimmedName, created_by: user.id })
    .select('id')
    .single()
  if (error || !room) return { error: error?.message ?? 'Could not create group' }

  const rows = [
    { room_id: room.id, user_id: user.id, role: 'owner' },
    ...uniqueMemberIds.map(id => ({ room_id: room.id, user_id: id, role: 'member' })),
  ]
  await admin.from('chat_members').insert(rows)

  revalidatePath('/chat')
  return room.id
}

/** Add one or more people to an existing group chat. Staff-only, blocked for auto-synced rooms. */
export async function addGroupMembers(roomId: string, memberIds: string[]): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Unauthorized' }

  const admin = createAdminClient()
  const { data: me } = await admin.from('users').select('role').eq('id', user.id).maybeSingle()
  if (!me || !['admin', 'coach', 'teacher'].includes(me.role)) return { ok: false, error: 'Staff only' }

  if (await isSyncedRoom(admin, roomId)) return { ok: false, error: 'This roster is managed automatically' }

  const uniqueMemberIds = Array.from(new Set(memberIds))
  if (uniqueMemberIds.length === 0) return { ok: false, error: 'Pick at least one member' }

  const rows = uniqueMemberIds.map(id => ({ room_id: roomId, user_id: id, role: 'member' }))
  const { error } = await admin.from('chat_members').upsert(rows, { onConflict: 'room_id,user_id', ignoreDuplicates: true })
  if (error) return { ok: false, error: error.message }

  revalidatePath(`/chat/${roomId}`)
  return { ok: true }
}

/** Remove one person from a group chat. Staff-only, blocked for auto-synced rooms. */
export async function removeGroupMember(roomId: string, userId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Unauthorized' }

  const admin = createAdminClient()
  const { data: me } = await admin.from('users').select('role').eq('id', user.id).maybeSingle()
  if (!me || !['admin', 'coach', 'teacher'].includes(me.role)) return { ok: false, error: 'Staff only' }

  if (await isSyncedRoom(admin, roomId)) return { ok: false, error: 'This roster is managed automatically' }

  const { error } = await admin.from('chat_members').delete().eq('room_id', roomId).eq('user_id', userId)
  if (error) return { ok: false, error: error.message }

  revalidatePath(`/chat/${roomId}`)
  return { ok: true }
}
```

- [ ] **Step 2: Guard `leaveOrDeleteRoom` against auto-synced rooms**

In the same file, find `leaveOrDeleteRoom`. Change:

```ts
  const { data: room } = await admin.from('chat_rooms').select('kind, created_by').eq('id', roomId).single()
  const { data: members } = await admin.from('chat_members').select('user_id').eq('room_id', roomId)

  if (!room) return { ok: false, error: 'Room not found' }
```

to:

```ts
  const { data: room } = await admin.from('chat_rooms').select('kind, created_by, sync_year_group').eq('id', roomId).single()
  const { data: members } = await admin.from('chat_members').select('user_id').eq('room_id', roomId)

  if (!room) return { ok: false, error: 'Room not found' }
  if (room.sync_year_group) return { ok: false, error: "You can't leave this — ask a coach if this looks wrong" }
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors introduced by `app/chat/actions.ts`. (This file has
no Jest coverage today — per Global Constraints, that's consistent with the
rest of this codebase's server actions; type-checking + the later live
verification in Task 7 is the check for this task.)

- [ ] **Step 4: Commit**

```bash
git add app/chat/actions.ts
git commit -m "feat: add group chat server actions (create/add/remove members, leave guard)"
```

---

### Task 3: `ChatRoomActions` — add `canLeave` prop

**Files:**
- Modify: `app/chat/ChatRoomActions.tsx`
- Test: `__tests__/components/chat/ChatRoomActions.test.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `ChatRoomActions` now accepts an optional `canLeave?: boolean`
  prop (default `true`). Consumed by Task 4's edit to `app/chat/page.tsx`.

- [ ] **Step 1: Write the failing test**

Create `__tests__/components/chat/ChatRoomActions.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { ChatRoomActions } from '@/app/chat/ChatRoomActions'

jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: jest.fn() }) }))
jest.mock('@/app/chat/actions', () => ({
  nudgeRoom: jest.fn(),
  leaveOrDeleteRoom: jest.fn(),
}))

describe('ChatRoomActions — canLeave', () => {
  it('shows "Leave conversation" in the menu by default', () => {
    render(<ChatRoomActions roomId="r1" isOwner={false} isDmOrBot={false} />)
    fireEvent.click(screen.getByLabelText('Chat options'))
    expect(screen.getByText('Leave conversation')).toBeInTheDocument()
  })

  it('hides the leave/delete menu item when canLeave is false', () => {
    render(<ChatRoomActions roomId="r1" isOwner={false} isDmOrBot={false} canLeave={false} />)
    fireEvent.click(screen.getByLabelText('Chat options'))
    expect(screen.queryByText('Leave conversation')).not.toBeInTheDocument()
    expect(screen.queryByText('Delete conversation')).not.toBeInTheDocument()
  })

  it('still shows Nudge when canLeave is false', () => {
    render(<ChatRoomActions roomId="r1" isOwner={false} isDmOrBot={false} canLeave={false} />)
    fireEvent.click(screen.getByLabelText('Chat options'))
    expect(screen.getByText('Nudge')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- __tests__/components/chat/ChatRoomActions.test.tsx`
Expected: FAIL — `canLeave` prop doesn't exist yet, so "Leave conversation"
renders in all three cases (test 2 fails).

- [ ] **Step 3: Add the `canLeave` prop**

In `app/chat/ChatRoomActions.tsx`, change:

```tsx
export function ChatRoomActions({
  roomId,
  isOwner,
  isDmOrBot,
}: {
  roomId: string
  isOwner: boolean
  isDmOrBot: boolean
}) {
```

to:

```tsx
export function ChatRoomActions({
  roomId,
  isOwner,
  isDmOrBot,
  canLeave = true,
}: {
  roomId: string
  isOwner: boolean
  isDmOrBot: boolean
  canLeave?: boolean
}) {
```

Then change:

```tsx
          <button
            onClick={handleNudge}
            className="flex w-full items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left font-medium"
          >
            <Bell size={15} className="text-tranmere-blue" />
            Nudge
          </button>
          <div className="border-t my-1" />
          <button
            onClick={handleLeave}
            className="flex w-full items-center gap-3 px-4 py-2.5 hover:bg-red-50 text-left font-medium text-red-600"
          >
            {isOwner && isDmOrBot ? <Trash2 size={15} /> : <LogOut size={15} />}
            {isOwner && isDmOrBot ? 'Delete conversation' : 'Leave conversation'}
          </button>
```

to:

```tsx
          <button
            onClick={handleNudge}
            className="flex w-full items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left font-medium"
          >
            <Bell size={15} className="text-tranmere-blue" />
            Nudge
          </button>
          {canLeave && (
            <>
              <div className="border-t my-1" />
              <button
                onClick={handleLeave}
                className="flex w-full items-center gap-3 px-4 py-2.5 hover:bg-red-50 text-left font-medium text-red-600"
              >
                {isOwner && isDmOrBot ? <Trash2 size={15} /> : <LogOut size={15} />}
                {isOwner && isDmOrBot ? 'Delete conversation' : 'Leave conversation'}
              </button>
            </>
          )}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- __tests__/components/chat/ChatRoomActions.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add app/chat/ChatRoomActions.tsx __tests__/components/chat/ChatRoomActions.test.tsx
git commit -m "feat: add canLeave prop to ChatRoomActions"
```

---

### Task 4: `NewGroupPicker` + wire into chat hub

**Files:**
- Create: `app/chat/NewGroupPicker.tsx`
- Test: `__tests__/components/chat/NewGroupPicker.test.tsx`
- Modify: `app/chat/page.tsx`

**Interfaces:**
- Consumes: `createGroupChat` from `./actions` (Task 2).
  `ChatRoomActions` with `canLeave` prop (Task 3).
- Produces: `NewGroupPicker({ directory: Person[] })` component, where
  `Person = { id: string; name: string | null; role: string; avatar_url: string | null }`.
  Rendered on the chat hub; no other task consumes it directly.

- [ ] **Step 1: Write the failing test**

Create `__tests__/components/chat/NewGroupPicker.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { NewGroupPicker } from '@/app/chat/NewGroupPicker'

const pushMock = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: pushMock }) }))

const createGroupChatMock = jest.fn()
jest.mock('@/app/chat/actions', () => ({
  createGroupChat: (...args: any[]) => createGroupChatMock(...args),
}))

const directory = [
  { id: 'u1', name: 'Alice Coach', role: 'coach', avatar_url: null },
  { id: 'u2', name: 'Bob Student', role: 'student', avatar_url: null },
]

describe('NewGroupPicker', () => {
  beforeEach(() => {
    pushMock.mockClear()
    createGroupChatMock.mockReset()
  })

  it('opens the picker and lists the directory', () => {
    render(<NewGroupPicker directory={directory} />)
    fireEvent.click(screen.getByText('New group'))
    expect(screen.getByText('Alice Coach')).toBeInTheDocument()
    expect(screen.getByText('Bob Student')).toBeInTheDocument()
  })

  it('shows an error instead of submitting when no name is entered', () => {
    render(<NewGroupPicker directory={directory} />)
    fireEvent.click(screen.getByText('New group'))
    fireEvent.click(screen.getByText('Bob Student'))
    fireEvent.click(screen.getByText(/Create group/))
    expect(screen.getByText('Give the group a name')).toBeInTheDocument()
    expect(createGroupChatMock).not.toHaveBeenCalled()
  })

  it('shows an error instead of submitting when no member is selected', () => {
    render(<NewGroupPicker directory={directory} />)
    fireEvent.click(screen.getByText('New group'))
    fireEvent.change(screen.getByPlaceholderText(/Group name/), { target: { value: 'Match Day Chat' } })
    fireEvent.click(screen.getByText(/Create group/))
    expect(screen.getByText('Pick at least one member')).toBeInTheDocument()
    expect(createGroupChatMock).not.toHaveBeenCalled()
  })

  it('submits the name and selected member ids, then navigates to the new room', async () => {
    createGroupChatMock.mockResolvedValue('room-123')
    render(<NewGroupPicker directory={directory} />)
    fireEvent.click(screen.getByText('New group'))
    fireEvent.change(screen.getByPlaceholderText(/Group name/), { target: { value: 'Match Day Chat' } })
    fireEvent.click(screen.getByText('Bob Student'))
    fireEvent.click(screen.getByText(/Create group/))
    await waitFor(() => expect(createGroupChatMock).toHaveBeenCalledWith('Match Day Chat', ['u2']))
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/chat/room-123'))
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- __tests__/components/chat/NewGroupPicker.test.tsx`
Expected: FAIL with "Cannot find module '@/app/chat/NewGroupPicker'"

- [ ] **Step 3: Write `app/chat/NewGroupPicker.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Users, Search, X } from 'lucide-react'
import { createGroupChat } from './actions'

type Person = { id: string; name: string | null; role: string; avatar_url: string | null }

export function NewGroupPicker({ directory }: { directory: Person[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filtered = q.trim()
    ? directory.filter(u => (u.name ?? '').toLowerCase().includes(q.toLowerCase()))
    : directory

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function submit() {
    setError(null)
    if (!name.trim()) { setError('Give the group a name'); return }
    if (selected.size === 0) { setError('Pick at least one member'); return }
    setSubmitting(true)
    const res = await createGroupChat(name.trim(), Array.from(selected))
    setSubmitting(false)
    if (typeof res === 'string') router.push(`/chat/${res}`)
    else setError(res.error)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-tranmere-blue text-tranmere-blue px-4 py-2.5 text-sm font-semibold hover:bg-tranmere-blue/5"
      >
        <Users size={14} /> New group
      </button>
    )
  }

  return (
    <div className="rounded-2xl border bg-white p-3 space-y-2">
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Group name (e.g. Match Day Chat)"
          className="flex-1 px-3 py-2 border rounded-lg text-sm"
        />
        <button onClick={() => setOpen(false)} className="p-2 rounded-lg hover:bg-gray-100" aria-label="Close">
          <X size={14} />
        </button>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search people…"
          className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm"
        />
      </div>

      <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
        {filtered.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No match</p>}
        {filtered.map(u => {
          const initials = (u.name ?? '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
          const checked = selected.has(u.id)
          return (
            <button
              key={u.id}
              onClick={() => toggle(u.id)}
              className={`w-full flex items-center gap-2.5 p-2 rounded-lg text-left ${checked ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
            >
              <input type="checkbox" checked={checked} readOnly className="shrink-0" />
              {u.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={u.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
              ) : (
                <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-tranmere-blue text-white text-xs font-bold shrink-0">
                  {initials}
                </span>
              )}
              <span className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{u.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{u.role}</p>
              </span>
            </button>
          )
        })}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        onClick={submit}
        disabled={submitting}
        className="w-full rounded-xl bg-gradient-to-r from-tranmere-blue to-blue-700 text-white px-4 py-2.5 text-sm font-semibold shadow disabled:opacity-50"
      >
        {submitting ? 'Creating…' : `Create group${selected.size ? ` (${selected.size})` : ''}`}
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- __tests__/components/chat/NewGroupPicker.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Wire into the chat hub**

In `app/chat/page.tsx`:

Change the import block:

```tsx
import { NewDmPicker } from './NewDmPicker'
import { AiCoachButton } from './AiCoachButton'
import { ChatRoomActions } from './ChatRoomActions'
```

to:

```tsx
import { NewDmPicker } from './NewDmPicker'
import { NewGroupPicker } from './NewGroupPicker'
import { AiCoachButton } from './AiCoachButton'
import { ChatRoomActions } from './ChatRoomActions'
```

Change the room-membership query:

```ts
  const { data: myMemberships, error } = await admin
    .from('chat_members')
    .select('room_id, last_read_at, chat_rooms(id, kind, name, match_id, last_message_at, created_by)')
    .eq('user_id', user.id)
    .order('chat_rooms(last_message_at)', { ascending: false } as any)
```

to:

```ts
  const { data: myMemberships, error } = await admin
    .from('chat_members')
    .select('room_id, last_read_at, chat_rooms(id, kind, name, match_id, last_message_at, created_by, sync_year_group)')
    .eq('user_id', user.id)
    .order('chat_rooms(last_message_at)', { ascending: false } as any)
```

In the `rooms` map, change:

```ts
      return {
        id: room.id,
        kind: room.kind,
        label,
        other,
        memberCount: members.length,
        lastMessage: last?.body ?? null,
        lastAt: room.last_message_at,
        unread: unreadByRoom[room.id] ?? 0,
        isOwner: room.created_by === user.id,
      }
```

to:

```ts
      return {
        id: room.id,
        kind: room.kind,
        label,
        other,
        memberCount: members.length,
        lastMessage: last?.body ?? null,
        lastAt: room.last_message_at,
        unread: unreadByRoom[room.id] ?? 0,
        isOwner: room.created_by === user.id,
        syncYearGroup: room.sync_year_group ?? null,
      }
```

After the existing `directory` query, add a second query that excludes
parents (used for group chats only — the existing `directory` still feeds
`NewDmPicker` unchanged):

```ts
  const { data: directory } = isStaff
    ? await admin.from('users').select('id, name, role, avatar_url').neq('id', user.id).order('name')
    : await admin.from('users').select('id, name, role, avatar_url').neq('id', user.id).in('role', ['coach','teacher','admin','student']).order('name')
```

to:

```ts
  const { data: directory } = isStaff
    ? await admin.from('users').select('id, name, role, avatar_url').neq('id', user.id).order('name')
    : await admin.from('users').select('id, name, role, avatar_url').neq('id', user.id).in('role', ['coach','teacher','admin','student']).order('name')

  // Group chat membership excludes parents — they use the parent portal instead.
  const { data: groupDirectory } = isStaff
    ? await admin.from('users').select('id, name, role, avatar_url').neq('id', user.id).neq('role', 'parent').order('name')
    : { data: [] as { id: string; name: string | null; role: string; avatar_url: string | null }[] }
```

Change the render block:

```tsx
      <AiCoachButton />
      <NewDmPicker directory={directory ?? []} />
```

to:

```tsx
      <AiCoachButton />
      <NewDmPicker directory={directory ?? []} />
      {isStaff && <NewGroupPicker directory={groupDirectory ?? []} />}
```

Finally, pass the new `canLeave` prop through to `ChatRoomActions`. Change:

```tsx
              <ChatRoomActions roomId={r.id} isOwner={r.isOwner} isDmOrBot={isDmOrBot} />
```

to:

```tsx
              <ChatRoomActions roomId={r.id} isOwner={r.isOwner} isDmOrBot={isDmOrBot} canLeave={!r.syncYearGroup} />
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors from `app/chat/page.tsx`.

- [ ] **Step 7: Commit**

```bash
git add app/chat/NewGroupPicker.tsx __tests__/components/chat/NewGroupPicker.test.tsx app/chat/page.tsx
git commit -m "feat: add New Group picker to chat hub"
```

---

### Task 5: `GroupMembers` — member list + remove control

**Files:**
- Create: `app/chat/[roomId]/GroupMembers.tsx`
- Test: `__tests__/components/chat/GroupMembers.test.tsx`

**Interfaces:**
- Consumes: `removeGroupMember` from `../actions` (Task 2).
- Produces: `GroupMembers({ roomId, members, currentUserId, isStaff, syncYearGroup })`,
  where `members: { user_id: string; role: string; users: { id: string; name: string | null; avatar_url: string | null; role: string } | null }[]`
  and `syncYearGroup: number | null`. Consumed by Task 7's edit to
  `app/chat/[roomId]/page.tsx`.

- [ ] **Step 1: Write the failing test**

Create `__tests__/components/chat/GroupMembers.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { GroupMembers } from '@/app/chat/[roomId]/GroupMembers'

const refreshMock = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: refreshMock }) }))

const removeGroupMemberMock = jest.fn()
jest.mock('@/app/chat/actions', () => ({
  removeGroupMember: (...args: any[]) => removeGroupMemberMock(...args),
}))

const members = [
  { user_id: 'me', role: 'owner', users: { id: 'me', name: 'Coach Me', avatar_url: null, role: 'coach' } },
  { user_id: 'u2', role: 'member', users: { id: 'u2', name: 'Bob Student', avatar_url: null, role: 'student' } },
]

describe('GroupMembers', () => {
  beforeEach(() => { refreshMock.mockClear(); removeGroupMemberMock.mockReset() })

  it('shows the member count and names', () => {
    render(<GroupMembers roomId="r1" members={members} currentUserId="me" isStaff={true} syncYearGroup={null} />)
    expect(screen.getByText('2 members')).toBeInTheDocument()
    expect(screen.getByText('Bob Student')).toBeInTheDocument()
  })

  it('shows the auto-synced badge and no remove controls for a sync room', () => {
    render(<GroupMembers roomId="r1" members={members} currentUserId="me" isStaff={true} syncYearGroup={1} />)
    expect(screen.getByText('Auto-synced roster')).toBeInTheDocument()
    expect(screen.queryByLabelText(/Remove/)).not.toBeInTheDocument()
  })

  it('shows a remove control for other members but not for yourself, when staff on a manual group', () => {
    render(<GroupMembers roomId="r1" members={members} currentUserId="me" isStaff={true} syncYearGroup={null} />)
    expect(screen.getByLabelText('Remove Bob Student')).toBeInTheDocument()
    expect(screen.queryByLabelText('Remove Coach Me')).not.toBeInTheDocument()
  })

  it('shows no remove controls for a non-staff viewer', () => {
    render(<GroupMembers roomId="r1" members={members} currentUserId="u2" isStaff={false} syncYearGroup={null} />)
    expect(screen.queryByLabelText(/Remove/)).not.toBeInTheDocument()
  })

  it('calls removeGroupMember with the room and user id on click', () => {
    removeGroupMemberMock.mockResolvedValue({ ok: true })
    render(<GroupMembers roomId="r1" members={members} currentUserId="me" isStaff={true} syncYearGroup={null} />)
    fireEvent.click(screen.getByLabelText('Remove Bob Student'))
    expect(removeGroupMemberMock).toHaveBeenCalledWith('r1', 'u2')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- __tests__/components/chat/GroupMembers.test.tsx`
Expected: FAIL with "Cannot find module '@/app/chat/[roomId]/GroupMembers'"

- [ ] **Step 3: Write `app/chat/[roomId]/GroupMembers.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { X, Users } from 'lucide-react'
import { removeGroupMember } from '../actions'

type Member = {
  user_id: string
  role: string
  users: { id: string; name: string | null; avatar_url: string | null; role: string } | null
}

export function GroupMembers({
  roomId,
  members,
  currentUserId,
  isStaff,
  syncYearGroup,
}: {
  roomId: string
  members: Member[]
  currentUserId: string
  isStaff: boolean
  syncYearGroup: number | null
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function handleRemove(userId: string) {
    setError(null)
    setRemovingId(userId)
    start(async () => {
      const res = await removeGroupMember(roomId, userId)
      setRemovingId(null)
      if (res.ok) router.refresh()
      else setError(res.error ?? 'Failed to remove')
    })
  }

  return (
    <div className="border-t bg-white p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
          <Users size={13} /> {members.length} members
        </p>
        {syncYearGroup && (
          <span className="text-[10px] font-medium text-tranmere-blue bg-tranmere-blue/10 px-2 py-0.5 rounded-full">
            Auto-synced roster
          </span>
        )}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="space-y-1 max-h-40 overflow-y-auto">
        {members.map(m => {
          const person = m.users
          const canRemove = isStaff && !syncYearGroup && m.user_id !== currentUserId
          return (
            <div key={m.user_id} className="flex items-center gap-2 text-sm py-1">
              <span className="flex-1 truncate">{person?.name ?? 'Unknown'}</span>
              {canRemove && (
                <button
                  onClick={() => handleRemove(m.user_id)}
                  disabled={pending && removingId === m.user_id}
                  aria-label={`Remove ${person?.name ?? 'member'}`}
                  className="text-gray-400 hover:text-red-600 disabled:opacity-50"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- __tests__/components/chat/GroupMembers.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add app/chat/[roomId]/GroupMembers.tsx __tests__/components/chat/GroupMembers.test.tsx
git commit -m "feat: add GroupMembers component"
```

---

### Task 6: `AddGroupMembers` — inline add-people picker

**Files:**
- Create: `app/chat/[roomId]/AddGroupMembers.tsx`
- Test: `__tests__/components/chat/AddGroupMembers.test.tsx`

**Interfaces:**
- Consumes: `addGroupMembers` from `../actions` (Task 2).
- Produces: `AddGroupMembers({ roomId, addable })`, where
  `addable: { id: string; name: string | null; role: string }[]`. Consumed
  by Task 7's edit to `app/chat/[roomId]/page.tsx`.

- [ ] **Step 1: Write the failing test**

Create `__tests__/components/chat/AddGroupMembers.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AddGroupMembers } from '@/app/chat/[roomId]/AddGroupMembers'

const refreshMock = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: refreshMock }) }))

const addGroupMembersMock = jest.fn()
jest.mock('@/app/chat/actions', () => ({
  addGroupMembers: (...args: any[]) => addGroupMembersMock(...args),
}))

const addable = [{ id: 'u3', name: 'Carla Teacher', role: 'teacher' }]

describe('AddGroupMembers', () => {
  beforeEach(() => { refreshMock.mockClear(); addGroupMembersMock.mockReset() })

  it('renders nothing when there is nobody left to add', () => {
    const { container } = render(<AddGroupMembers roomId="r1" addable={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('opens and lists addable people', () => {
    render(<AddGroupMembers roomId="r1" addable={addable} />)
    fireEvent.click(screen.getByText('Add people'))
    expect(screen.getByText('Carla Teacher')).toBeInTheDocument()
  })

  it('shows an error instead of submitting with nobody selected', () => {
    render(<AddGroupMembers roomId="r1" addable={addable} />)
    fireEvent.click(screen.getByText('Add people'))
    fireEvent.click(screen.getByText(/^Add$/))
    expect(screen.getByText('Pick at least one person')).toBeInTheDocument()
    expect(addGroupMembersMock).not.toHaveBeenCalled()
  })

  it('submits selected ids and refreshes on success', async () => {
    addGroupMembersMock.mockResolvedValue({ ok: true })
    render(<AddGroupMembers roomId="r1" addable={addable} />)
    fireEvent.click(screen.getByText('Add people'))
    fireEvent.click(screen.getByText('Carla Teacher'))
    fireEvent.click(screen.getByText(/Add \(1\)/))
    await waitFor(() => expect(addGroupMembersMock).toHaveBeenCalledWith('r1', ['u3']))
    await waitFor(() => expect(refreshMock).toHaveBeenCalled())
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- __tests__/components/chat/AddGroupMembers.test.tsx`
Expected: FAIL with "Cannot find module '@/app/chat/[roomId]/AddGroupMembers'"

- [ ] **Step 3: Write `app/chat/[roomId]/AddGroupMembers.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, X } from 'lucide-react'
import { addGroupMembers } from '../actions'

type Person = { id: string; name: string | null; role: string }

export function AddGroupMembers({ roomId, addable }: { roomId: string; addable: Person[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const filtered = q.trim()
    ? addable.filter(u => (u.name ?? '').toLowerCase().includes(q.toLowerCase()))
    : addable

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function submit() {
    setError(null)
    if (selected.size === 0) { setError('Pick at least one person'); return }
    start(async () => {
      const res = await addGroupMembers(roomId, Array.from(selected))
      if (res.ok) {
        setOpen(false)
        setSelected(new Set())
        router.refresh()
      } else {
        setError(res.error ?? 'Failed to add members')
      }
    })
  }

  if (addable.length === 0 && !open) return null

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs font-semibold text-tranmere-blue"
      >
        <UserPlus size={13} /> Add people
      </button>
    )
  }

  return (
    <div className="border rounded-xl p-2 space-y-2 bg-gray-50">
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search people…"
          className="flex-1 px-2 py-1.5 border rounded-lg text-xs"
        />
        <button onClick={() => setOpen(false)} aria-label="Close" className="p-1 rounded hover:bg-gray-200">
          <X size={13} />
        </button>
      </div>

      <div className="max-h-32 overflow-y-auto space-y-1">
        {filtered.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">No match</p>}
        {filtered.map(u => {
          const checked = selected.has(u.id)
          return (
            <button
              key={u.id}
              onClick={() => toggle(u.id)}
              className={`w-full flex items-center gap-2 p-1.5 rounded-lg text-left text-xs ${checked ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
            >
              <input type="checkbox" checked={checked} readOnly />
              <span className="flex-1 truncate">{u.name}</span>
            </button>
          )
        })}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        onClick={submit}
        disabled={pending}
        className="w-full rounded-lg bg-tranmere-blue text-white px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
      >
        {pending ? 'Adding…' : `Add${selected.size ? ` (${selected.size})` : ''}`}
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- __tests__/components/chat/AddGroupMembers.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add app/chat/[roomId]/AddGroupMembers.tsx __tests__/components/chat/AddGroupMembers.test.tsx
git commit -m "feat: add AddGroupMembers component"
```

---

### Task 7: Wire `GroupMembers`/`AddGroupMembers` into the room page, then run the migration

**Files:**
- Modify: `app/chat/[roomId]/page.tsx`

**Interfaces:**
- Consumes: `GroupMembers` (Task 5), `AddGroupMembers` (Task 6).
- Produces: nothing new — final integration task.

- [ ] **Step 1: Add imports**

In `app/chat/[roomId]/page.tsx`, change:

```tsx
import { ChatThread } from './ChatThread'
```

to:

```tsx
import { ChatThread } from './ChatThread'
import { GroupMembers } from './GroupMembers'
import { AddGroupMembers } from './AddGroupMembers'
```

- [ ] **Step 2: Compute `isGroupRoom` and the addable directory**

Change:

```tsx
  if (!me) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-muted-foreground">You&apos;re not a member of this conversation.</p>
        <Link href="/chat" className="text-tranmere-blue underline mt-2 inline-block">Back</Link>
      </div>
    )
  }

  // Most recent 100 messages only
```

to:

```tsx
  if (!me) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-muted-foreground">You&apos;re not a member of this conversation.</p>
        <Link href="/chat" className="text-tranmere-blue underline mt-2 inline-block">Back</Link>
      </div>
    )
  }

  const isGroupRoom = room.kind === 'custom'

  // For staff on a manually-managed group, load who could still be added —
  // everyone except parents and everyone already a member.
  let addable: { id: string; name: string | null; role: string }[] = []
  if (isGroupRoom && isStaff && !room.sync_year_group) {
    const memberIds = (members ?? []).map((m: any) => m.user_id)
    const { data: candidates } = await admin
      .from('users')
      .select('id, name, role')
      .neq('role', 'parent')
      .order('name')
    addable = (candidates ?? []).filter(c => !memberIds.includes(c.id))
  }

  // Most recent 100 messages only
```

(This keeps the existing comment about the 100-message limit attached to
the query below it — only the code between `if (!me)` and that comment
changes.)

- [ ] **Step 3: Render `GroupMembers`/`AddGroupMembers` between the header and `ChatThread`**

Change:

```tsx
      </header>

      <ChatThread
```

to:

```tsx
      </header>

      {isGroupRoom && (
        <GroupMembers
          roomId={params.roomId}
          members={(members ?? []) as any}
          currentUserId={user.id}
          isStaff={!!isStaff}
          syncYearGroup={room.sync_year_group ?? null}
        />
      )}
      {isGroupRoom && isStaff && !room.sync_year_group && (
        <div className="border-t bg-white px-3 pb-2">
          <AddGroupMembers roomId={params.roomId} addable={addable} />
        </div>
      )}

      <ChatThread
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors from `app/chat/[roomId]/page.tsx`.

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: PASS — every test from Tasks 3, 4, 5, 6 plus the pre-existing
suite all green.

- [ ] **Step 6: Commit**

```bash
git add app/chat/[roomId]/page.tsx
git commit -m "feat: wire GroupMembers/AddGroupMembers into the chat room page"
```

- [ ] **Step 7: Run the migration and verify live**

This is a manual step, not automatable from this session:

1. Open the Supabase SQL Editor for this project.
2. Run `supabase/migrations/044_group_chat.sql` (written in Task 1).
3. Confirm three new rows exist: `select name, kind, sync_year_group from chat_rooms where name in ('Year 1 Students', 'Year 2 Students', 'Match Day Chat');`
4. Confirm the backfill populated membership:
   `select r.name, count(*) from chat_members cm join chat_rooms r on r.id = cm.room_id where r.sync_year_group is not null group by r.name;`
   — should show a member count matching the number of `role = 'student'`
   users at each `year_group`.
5. In the deployed app, log in as an admin/coach/teacher: confirm "New
   group" appears on `/chat`, confirm the two "Students" rooms and "Match
   Day Chat" appear in the room list with the right member counts, confirm
   adding/removing a member on Match Day Chat works, and confirm the two
   auto-synced rooms show "Auto-synced roster" with no add/remove controls
   and no "Leave" option.
6. Log in as a student: confirm they see their own year-group room (with no
   leave option) and do **not** see the other year group's room.

---

## Self-Review Notes

- **Spec coverage:** every section of `docs/superpowers/specs/2026-08-21-group-chat-design.md`
  maps to a task — data model (Task 1), server actions (Task 2), leave-lock
  (Tasks 2 + 3), create-group UI (Task 4), manage-members UI (Tasks 5–7),
  parent exclusion (Tasks 4 and 7's directory queries), testing convention
  (all tasks).
- **Deviation from the spec, called out:** the spec's UI section said
  `GroupMembers` should render "for any `kind: 'custom'` room with more
  than 2 members." Task 7 renders it for every `kind: 'custom'` room
  instead. Reason: a brand-new group can have exactly 2 members (creator +
  one pick), and gating the member list on `> 2` would make it impossible
  for staff to ever add a 3rd person to that group through the UI — a
  lockout bug the ">2" phrasing didn't intend. Showing it for all `custom`
  rooms avoids that with no downside.
- **Type consistency:** `Member` shape in Task 5 matches the `members`
  query shape already used in `app/chat/[roomId]/page.tsx`
  (`user_id, role, users:user_id(id, name, avatar_url, role)`). `Person`
  shape in Tasks 4 and 6 matches the `id, name, role[, avatar_url]` shape
  each directory query in Task 4/7 selects. Action return types
  (`string | { error }` for `createGroupChat`; `{ ok, error? }` for the
  other two) match the existing `getOrCreateDM` / `nudgeRoom` conventions
  in `app/chat/actions.ts` exactly, so the new UI code can pattern-match
  the same way `NewDmPicker`/`ChatRoomActions` already do.
