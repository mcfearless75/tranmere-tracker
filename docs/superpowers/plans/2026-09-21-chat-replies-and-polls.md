# Chat Replies and Polls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let chat users reply to a specific message, and let staff post single-choice polls that room members vote on with live results.

**Architecture:** A poll is a `chat_messages` row carrying a `poll_id`, so it inherits the existing timeline ordering, realtime delivery and soft-delete. Replies are a nullable `reply_to_id` self-reference on the same table. Vote privacy is enforced in RLS, not the UI: students can read only their own vote row, while tallies live in a denormalised `vote_count` column on `chat_poll_options` that a trigger maintains and everyone can read.

**Tech Stack:** Next.js 14 App Router, TypeScript 5 (strict), Supabase (`@supabase/ssr`) with RLS and Realtime, Tailwind, Jest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-21-chat-replies-and-polls-design.md`

## Global Constraints

- **Supabase client:** always `@supabase/ssr` — `createClient` from `@/lib/supabase/server` in Server Components and Server Actions, `@/lib/supabase/client` in Client Components. Never the plain `supabase-js` browser client.
- **`.maybeSingle()`** for any lookup that may legitimately return no row. `.single()` only where the row is guaranteed.
- **TypeScript strict** — no `any` without a written justification comment.
- **Components live in `components/`**, not inline in page files.
- **Every new feature needs Jest tests** in `__tests__/`.
- **Task review runs `npm run build`**, not only `tsc` and `jest`. `next.config.js` ignores lint and typecheck during builds, so CI is the only enforcement and a lint error can pass tests while failing Vercel.
- **Migration numbering:** this work is `082`. `079` is `users_role_check_repair` on master; `080_trial_event_staff` and `081_document_folder_parent` are on the in-flight branch `fix/migration-number-collisions`. That branch exists *because* this repo has already had duplicate migration numbers, so re-colliding would be careless. **Before starting Task 1, re-check `ls supabase/migrations/` on the current master** — if that branch has merged and pushed the number further, take the next free one and update every reference in this plan.
- **Migrations are not applied by CI.** Writing the file is not applying it. Task 1 applies and verifies against production.
- **Poll limits, exact:** question 1–200 chars, option label 1–80 chars, 2–6 options per poll. These values appear in the DB check constraints, the shared constants, the form `maxLength`, and the server-action validation — they must match in all four places.
- **"Staff" in poll code always means `public.is_chat_staff()`** (admin/coach/teacher), never `public.is_staff()` (admin/coach only).
- **Commit messages** end with `Co-Authored-By: claude-flow <ruv@ruv.net>`.

---

## File Structure

| File | Responsibility |
|---|---|
| `supabase/migrations/082_chat_replies_and_polls.sql` | Schema, `is_chat_staff()`, vote-count trigger, RLS, realtime publication |
| `lib/chat/types.ts` | Shared types and poll limit constants, imported by server page, actions and client components |
| `components/chat/MessageBubble.tsx` | One message's bubble — extracted from `ChatThread.tsx`, then extended |
| `components/chat/ReplyQuote.tsx` | The quoted strip, used above the composer and inside bubbles |
| `components/chat/PollCard.tsx` | Renders a poll: options, live bars, your choice, Close, staff voter list |
| `components/chat/CreatePollSheet.tsx` | Poll composition form with length limits |
| `components/chat/MessageReactionSheet.tsx` | Gains a Reply action |
| `app/chat/[roomId]/ChatThread.tsx` | Wires reply and poll state, realtime subscriptions |
| `app/chat/[roomId]/page.tsx` | Server-fetches reply parents, polls, options and the viewer's votes |
| `app/chat/actions.ts` | `createPoll`, `closePoll`, and `notifyRoomMembers` reply targeting |

---

## Task 1: Migration 082 — schema, helper, trigger, RLS

**Files:**
- Create: `supabase/migrations/082_chat_replies_and_polls.sql`

**Interfaces:**
- Consumes: existing `public.is_chat_member(uuid)` and `public.is_staff()` from migrations `011` and `068`.
- Produces: tables `chat_polls`, `chat_poll_options`, `chat_poll_votes`; columns `chat_messages.reply_to_id`, `chat_messages.poll_id`; functions `public.is_chat_staff()`, `public.is_poll_room_member(uuid)`, `public.sync_poll_vote_counts()`.

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/082_chat_replies_and_polls.sql`:

```sql
-- Message replies + staff-created single-choice polls.
-- Spec: docs/superpowers/specs/2026-09-21-chat-replies-and-polls-design.md

-- ── 1. Chat-layer staff helper ──────────────────────────────────────────
-- public.is_staff() covers admin+coach only, but app/chat/[roomId]/page.tsx
-- already treats teacher as staff when deciding who may post in a broadcast
-- room. Polls follow the chat layer's definition, or teachers would see a
-- Create Poll button that the database silently rejects.
-- is_active = true follows the precedent set in migration 068.
create or replace function public.is_chat_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid()
      and role in ('admin', 'coach', 'teacher')
      and is_active = true
  )
$$;

-- ── 2. Poll tables ──────────────────────────────────────────────────────
create table if not exists chat_polls (
  id         uuid primary key default uuid_generate_v4(),
  room_id    uuid not null references chat_rooms(id) on delete cascade,
  created_by uuid not null references public.users(id),
  question   text not null check (char_length(question) between 1 and 200),
  closed_at  timestamptz,
  created_at timestamptz default now()
);

create table if not exists chat_poll_options (
  id         uuid primary key default uuid_generate_v4(),
  poll_id    uuid not null references chat_polls(id) on delete cascade,
  label      text not null check (char_length(label) between 1 and 80),
  position   int  not null,
  vote_count int  not null default 0,
  unique (poll_id, position)
);

-- unique (poll_id, user_id) is what makes this single-choice: changing your
-- vote is an UPDATE of option_id on your existing row, never a second row.
create table if not exists chat_poll_votes (
  id         uuid primary key default uuid_generate_v4(),
  poll_id    uuid not null references chat_polls(id) on delete cascade,
  option_id  uuid not null references chat_poll_options(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  created_at timestamptz default now(),
  unique (poll_id, user_id)
);

-- ── 3. Message columns ──────────────────────────────────────────────────
alter table chat_messages
  add column if not exists reply_to_id uuid references chat_messages(id) on delete set null,
  add column if not exists poll_id     uuid references chat_polls(id)    on delete cascade;

create index if not exists chat_messages_reply_to
  on chat_messages(reply_to_id) where reply_to_id is not null;
create index if not exists chat_poll_options_poll on chat_poll_options(poll_id, position);
create index if not exists chat_poll_votes_poll   on chat_poll_votes(poll_id);

-- ── 4. Vote-count trigger ───────────────────────────────────────────────
-- Tallies live here so students can read counts without being able to read
-- anyone else's vote row. security definer because a student changing their
-- own vote must move a count they have no UPDATE policy for.
create or replace function public.sync_poll_vote_counts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    update chat_poll_options set vote_count = vote_count + 1 where id = new.option_id;
  elsif TG_OP = 'DELETE' then
    update chat_poll_options set vote_count = greatest(vote_count - 1, 0) where id = old.option_id;
  elsif TG_OP = 'UPDATE' and new.option_id is distinct from old.option_id then
    update chat_poll_options set vote_count = greatest(vote_count - 1, 0) where id = old.option_id;
    update chat_poll_options set vote_count = vote_count + 1 where id = new.option_id;
  end if;
  return null;
end;
$$;

drop trigger if exists chat_poll_votes_sync on chat_poll_votes;
create trigger chat_poll_votes_sync
  after insert or update or delete on chat_poll_votes
  for each row execute function public.sync_poll_vote_counts();

-- ── 5. RLS ──────────────────────────────────────────────────────────────
alter table chat_polls        enable row level security;
alter table chat_poll_options enable row level security;
alter table chat_poll_votes   enable row level security;

create or replace function public.is_poll_room_member(pid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from chat_polls p
    where p.id = pid and public.is_chat_member(p.room_id)
  )
$$;

drop policy if exists "members read polls" on chat_polls;
create policy "members read polls" on chat_polls
  for select using (public.is_chat_member(room_id));

drop policy if exists "chat staff create polls" on chat_polls;
create policy "chat staff create polls" on chat_polls
  for insert with check (
    public.is_chat_staff()
    and public.is_chat_member(room_id)
    and created_by = auth.uid()
  );

drop policy if exists "chat staff close polls" on chat_polls;
create policy "chat staff close polls" on chat_polls
  for update using (public.is_chat_staff() and public.is_chat_member(room_id));

drop policy if exists "members read options" on chat_poll_options;
create policy "members read options" on chat_poll_options
  for select using (public.is_poll_room_member(poll_id));

drop policy if exists "chat staff create options" on chat_poll_options;
create policy "chat staff create options" on chat_poll_options
  for insert with check (public.is_chat_staff() and public.is_poll_room_member(poll_id));

-- Staff must ALSO be in the room. Without is_poll_room_member here, any
-- teacher anywhere could read every vote in every room they've never joined.
drop policy if exists "own vote or room staff reads" on chat_poll_votes;
create policy "own vote or room staff reads" on chat_poll_votes
  for select using (
    user_id = auth.uid()
    or (public.is_chat_staff() and public.is_poll_room_member(poll_id))
  );

drop policy if exists "members vote" on chat_poll_votes;
create policy "members vote" on chat_poll_votes
  for insert with check (
    user_id = auth.uid()
    and public.is_poll_room_member(poll_id)
    and exists (select 1 from chat_polls p where p.id = poll_id and p.closed_at is null)
  );

drop policy if exists "change own vote" on chat_poll_votes;
create policy "change own vote" on chat_poll_votes
  for update using (
    user_id = auth.uid()
    and exists (select 1 from chat_polls p where p.id = poll_id and p.closed_at is null)
  );

drop policy if exists "remove own vote" on chat_poll_votes;
create policy "remove own vote" on chat_poll_votes
  for delete using (user_id = auth.uid());

-- ── 6. Realtime ─────────────────────────────────────────────────────────
-- chat_poll_options carries the tallies, so publishing it gives live counts
-- to everyone without a single vote row crossing the wire to a student.
-- chat_poll_votes is deliberately NOT published.
alter table chat_poll_options replica identity full;
alter table chat_polls        replica identity full;

do $$
begin
  begin alter publication supabase_realtime add table chat_poll_options; exception when others then null; end;
  begin alter publication supabase_realtime add table chat_polls;        exception when others then null; end;
end $$;
```

- [ ] **Step 2: Apply the migration to production**

Use the Supabase MCP `apply_migration` tool with name `082_chat_replies_and_polls` and the file's contents as the query.

If the Supabase MCP tool is unavailable in the session, fall back to:

```bash
supabase db query --linked --file supabase/migrations/082_chat_replies_and_polls.sql
```

- [ ] **Step 3: Verify it actually landed**

This repo has no CI step that applies migrations — a committed file is not an applied migration. Run each check and confirm the expected result.

```sql
-- Expect 3 rows: chat_poll_options, chat_poll_votes, chat_polls
select table_name from information_schema.tables
where table_schema = 'public' and table_name like 'chat_poll%'
order by table_name;

-- Expect 2 rows: poll_id, reply_to_id
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'chat_messages'
  and column_name in ('reply_to_id', 'poll_id')
order by column_name;

-- Expect 3 rows: is_chat_staff, is_poll_room_member, sync_poll_vote_counts
select proname from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('is_chat_staff', 'is_poll_room_member', 'sync_poll_vote_counts')
order by proname;

-- Expect 1 row: chat_poll_votes_sync
select tgname from pg_trigger where tgname = 'chat_poll_votes_sync';

-- Expect 9 rows across the three tables
select tablename, policyname from pg_policies
where tablename in ('chat_polls', 'chat_poll_options', 'chat_poll_votes')
order by tablename, policyname;

-- Expect chat_poll_options and chat_polls; chat_poll_votes must NOT appear
select tablename from pg_publication_tables
where pubname = 'supabase_realtime' and tablename like 'chat_poll%'
order by tablename;
```

- [ ] **Step 4: Verify the trigger arithmetic against production**

Run this inside an explicit transaction and roll back, so nothing persists. It proves the trigger increments, moves and decrements correctly.

```sql
begin;
  insert into chat_polls (id, room_id, created_by, question)
  select '00000000-0000-0000-0000-0000000000aa', r.id, r.created_by, 'trigger probe'
  from chat_rooms r limit 1;

  insert into chat_poll_options (id, poll_id, label, position) values
    ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000aa', 'A', 0),
    ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000aa', 'B', 1);

  insert into chat_poll_votes (poll_id, option_id, user_id)
  select '00000000-0000-0000-0000-0000000000aa', '00000000-0000-0000-0000-0000000000b1', u.id
  from public.users u limit 1;
  -- Expect A=1, B=0
  select label, vote_count from chat_poll_options
  where poll_id = '00000000-0000-0000-0000-0000000000aa' order by position;

  update chat_poll_votes set option_id = '00000000-0000-0000-0000-0000000000b2'
  where poll_id = '00000000-0000-0000-0000-0000000000aa';
  -- Expect A=0, B=1
  select label, vote_count from chat_poll_options
  where poll_id = '00000000-0000-0000-0000-0000000000aa' order by position;

  delete from chat_poll_votes where poll_id = '00000000-0000-0000-0000-0000000000aa';
  -- Expect A=0, B=0
  select label, vote_count from chat_poll_options
  where poll_id = '00000000-0000-0000-0000-0000000000aa' order by position;
rollback;
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/082_chat_replies_and_polls.sql
git commit -m "feat(chat): schema for message replies and polls

Adds chat_polls/chat_poll_options/chat_poll_votes, reply_to_id and
poll_id on chat_messages, a vote-count trigger, and RLS.

is_chat_staff() is new: public.is_staff() covers admin+coach only, but
the chat layer already treats teacher as staff, so polls would have
shown teachers a button the database rejects.

Vote privacy is enforced in RLS - students read only their own vote row;
tallies live in chat_poll_options.vote_count, which everyone can read and
which is published to realtime in place of the vote rows.

Applied and verified against production.

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

## Task 2: Shared types and limits

**Files:**
- Create: `lib/chat/types.ts`
- Test: `__tests__/lib/chat/pollLimits.test.ts`

**Interfaces:**
- Produces: `Poll`, `PollOption`, `PollVote`, `ReplyParent`, `ChatMessage` types; constants `POLL_QUESTION_MAX`, `POLL_OPTION_MAX`, `POLL_MIN_OPTIONS`, `POLL_MAX_OPTIONS`; function `validatePollInput(question: string, options: string[]): string | null` returning an error message or `null`.

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/chat/pollLimits.test.ts`:

```ts
/** @jest-environment node */
import {
  POLL_QUESTION_MAX,
  POLL_OPTION_MAX,
  POLL_MIN_OPTIONS,
  POLL_MAX_OPTIONS,
  validatePollInput,
} from '@/lib/chat/types'

describe('validatePollInput', () => {
  it('accepts a normal poll', () => {
    expect(validatePollInput('Who is coming Saturday?', ['Yes', 'No'])).toBeNull()
  })

  it('rejects an empty question', () => {
    expect(validatePollInput('   ', ['Yes', 'No'])).toBe('Add a question')
  })

  it('rejects an over-length question', () => {
    expect(validatePollInput('q'.repeat(POLL_QUESTION_MAX + 1), ['Yes', 'No']))
      .toBe(`Question must be ${POLL_QUESTION_MAX} characters or fewer`)
  })

  it('rejects fewer than the minimum options', () => {
    expect(validatePollInput('Q', ['Only one']))
      .toBe(`Add at least ${POLL_MIN_OPTIONS} options`)
  })

  it('ignores blank option rows when counting', () => {
    expect(validatePollInput('Q', ['Yes', '  ', '']))
      .toBe(`Add at least ${POLL_MIN_OPTIONS} options`)
  })

  it('rejects more than the maximum options', () => {
    const many = Array.from({ length: POLL_MAX_OPTIONS + 1 }, (_, i) => `Option ${i}`)
    expect(validatePollInput('Q', many)).toBe(`Use ${POLL_MAX_OPTIONS} options or fewer`)
  })

  it('rejects an over-length option label', () => {
    expect(validatePollInput('Q', ['Yes', 'x'.repeat(POLL_OPTION_MAX + 1)]))
      .toBe(`Each option must be ${POLL_OPTION_MAX} characters or fewer`)
  })

  it('rejects duplicate options', () => {
    expect(validatePollInput('Q', ['Yes', 'yes'])).toBe('Options must be different')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/lib/chat/pollLimits.test.ts`
Expected: FAIL — cannot find module `@/lib/chat/types`

- [ ] **Step 3: Write the implementation**

Create `lib/chat/types.ts`:

```ts
/** Limits mirrored by the DB check constraints in migration 082 and by the
 *  CreatePollSheet maxLength attributes. Change all three together. */
export const POLL_QUESTION_MAX = 200
export const POLL_OPTION_MAX = 80
export const POLL_MIN_OPTIONS = 2
export const POLL_MAX_OPTIONS = 6

export type ChatMessage = {
  id: string
  sender_id: string
  body: string | null
  attachment_url: string | null
  attachment_kind: string | null
  created_at: string
  reply_to_id: string | null
  poll_id: string | null
}

/** A message quoted by a reply. Kept deliberately narrow — a quote shows a
 *  name and one line, never the full message. */
export type ReplyParent = {
  id: string
  sender_id: string
  body: string | null
  attachment_kind: string | null
  deleted_at: string | null
}

export type Poll = {
  id: string
  room_id: string
  created_by: string
  question: string
  closed_at: string | null
  created_at: string
}

export type PollOption = {
  id: string
  poll_id: string
  label: string
  position: number
  vote_count: number
}

export type PollVote = {
  id: string
  poll_id: string
  option_id: string
  user_id: string
}

/** Returns an error message, or null when the input is valid.
 *  Used by both CreatePollSheet (for inline feedback) and createPoll (which
 *  must not trust the client). */
export function validatePollInput(question: string, options: string[]): string | null {
  const q = question.trim()
  if (!q) return 'Add a question'
  if (q.length > POLL_QUESTION_MAX) {
    return `Question must be ${POLL_QUESTION_MAX} characters or fewer`
  }

  const filled = options.map(o => o.trim()).filter(Boolean)
  if (filled.length < POLL_MIN_OPTIONS) return `Add at least ${POLL_MIN_OPTIONS} options`
  if (filled.length > POLL_MAX_OPTIONS) return `Use ${POLL_MAX_OPTIONS} options or fewer`
  if (filled.some(o => o.length > POLL_OPTION_MAX)) {
    return `Each option must be ${POLL_OPTION_MAX} characters or fewer`
  }

  const seen = new Set(filled.map(o => o.toLowerCase()))
  if (seen.size !== filled.length) return 'Options must be different'

  return null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/lib/chat/pollLimits.test.ts`
Expected: PASS, 8 tests

- [ ] **Step 5: Commit**

```bash
git add lib/chat/types.ts __tests__/lib/chat/pollLimits.test.ts
git commit -m "feat(chat): shared poll types and input validation

validatePollInput is shared by the form and the server action so the
client cannot bypass the limits, and so the limits cannot drift apart.

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

## Task 3: Extract MessageBubble from ChatThread

Pure refactor. No behaviour changes, no new props. This exists because `ChatThread.tsx` is 438 lines and later tasks add reply state, poll state, two realtime subscriptions and a second bottom sheet to it.

**Files:**
- Create: `components/chat/MessageBubble.tsx`
- Modify: `app/chat/[roomId]/ChatThread.tsx` (the `messages.map` block)
- Test: `__tests__/components/chat/MessageBubble.test.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `MessageBubble` with exactly this prop shape — later tasks extend it.

```ts
export type ReactionChip = { emoji: string; count: number; mine: boolean }

export type MessageBubbleProps = {
  message: ChatMessage
  mine: boolean
  isBot: boolean
  showAvatar: boolean
  senderName: string
  avatarUrl: string | null
  chips: ReactionChip[]
  attachmentSrc: (url: string) => string | null
  onOpenSheet: (messageId: string) => void
  onToggleReaction: (messageId: string, emoji: string) => void
}
```

- [ ] **Step 1: Confirm the existing tests pass before touching anything**

Run: `npx jest __tests__/components/chat/ChatThread.test.tsx`
Expected: PASS. If it already fails, stop and report — this task assumes a green baseline.

- [ ] **Step 2: Write the failing test**

Create `__tests__/components/chat/MessageBubble.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { MessageBubble } from '@/components/chat/MessageBubble'
import type { ChatMessage } from '@/lib/chat/types'

const baseMessage: ChatMessage = {
  id: 'm1',
  sender_id: 'u2',
  body: 'Training moved to 6pm',
  attachment_url: null,
  attachment_kind: null,
  created_at: '2026-09-21T17:00:00.000Z',
  reply_to_id: null,
  poll_id: null,
}

function renderBubble(overrides: Partial<React.ComponentProps<typeof MessageBubble>> = {}) {
  const props = {
    message: baseMessage,
    mine: false,
    isBot: false,
    showAvatar: true,
    senderName: 'Coach Phil',
    avatarUrl: null,
    chips: [],
    attachmentSrc: (url: string) => url,
    onOpenSheet: jest.fn(),
    onToggleReaction: jest.fn(),
    ...overrides,
  }
  render(<MessageBubble {...props} />)
  return props
}

describe('MessageBubble', () => {
  it('renders the body and the sender name when the avatar is shown', () => {
    renderBubble()
    expect(screen.getByText('Training moved to 6pm')).toBeInTheDocument()
    expect(screen.getByText('Coach Phil')).toBeInTheDocument()
  })

  it('hides the sender name on a follow-up message from the same sender', () => {
    renderBubble({ showAvatar: false })
    expect(screen.queryByText('Coach Phil')).not.toBeInTheDocument()
  })

  it('labels a bot message as AI Coach', () => {
    renderBubble({ isBot: true })
    expect(screen.getByText('AI Coach')).toBeInTheDocument()
  })

  it('opens the sheet from the react button', () => {
    const props = renderBubble()
    fireEvent.click(screen.getByLabelText('React to message'))
    expect(props.onOpenSheet).toHaveBeenCalledWith('m1')
  })

  it('renders reaction chips and toggles one when tapped', () => {
    const props = renderBubble({ chips: [{ emoji: '👍', count: 3, mine: true }] })
    fireEvent.click(screen.getByText('👍 3'))
    expect(props.onToggleReaction).toHaveBeenCalledWith('m1', '👍')
  })

  it('renders a file attachment as a download link', () => {
    renderBubble({
      message: { ...baseMessage, attachment_kind: 'file', attachment_url: 'u2/plan.pdf' },
    })
    expect(screen.getByRole('link', { name: /plan\.pdf/ })).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest __tests__/components/chat/MessageBubble.test.tsx`
Expected: FAIL — cannot find module `@/components/chat/MessageBubble`

- [ ] **Step 4: Create the component**

Move the JSX currently inside `ChatThread.tsx`'s `messages.map` callback into `components/chat/MessageBubble.tsx`, unchanged apart from reading values from props instead of closure. Keep `ChatImage`, `MessageBody`, the long-press handlers, the `SmilePlus` buttons on both sides, the timestamp formatting (`en-GB`, `Europe/London`) and every Tailwind class exactly as they are. The hold-timer refs (`holdTimer`, `holdStart`) move into the component since they are per-bubble.

- [ ] **Step 5: Rewrite the map in ChatThread**

Replace the map body with:

```tsx
{messages.map((m, i) => {
  const prev = messages[i - 1]
  const isBot = m.sender_id === BOT_USER_ID
  const sender = memberById[m.sender_id]?.users
  return (
    <MessageBubble
      key={m.id}
      message={m}
      mine={m.sender_id === currentUserId}
      isBot={isBot}
      showAvatar={m.sender_id !== currentUserId && (!prev || prev.sender_id !== m.sender_id)}
      senderName={isBot ? 'AI Coach' : (sender?.name ?? '?')}
      avatarUrl={sender?.avatar_url ?? null}
      chips={reactionsFor(m.id)}
      attachmentSrc={attachmentSrc}
      onOpenSheet={openSheet}
      onToggleReaction={toggleReaction}
    />
  )
})}
```

- [ ] **Step 6: Run both test files to verify nothing regressed**

Run: `npx jest __tests__/components/chat/`
Expected: PASS — the new `MessageBubble` tests and the untouched `ChatThread` tests both green.

- [ ] **Step 7: Commit**

```bash
git add components/chat/MessageBubble.tsx __tests__/components/chat/MessageBubble.test.tsx "app/chat/[roomId]/ChatThread.tsx"
git commit -m "refactor(chat): extract MessageBubble from ChatThread

Pure move, no behaviour change - ChatThread is 438 lines and replies and
polls add two more realtime subscriptions, a second sheet and two new
pieces of state to it.

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

## Task 4: ReplyQuote component

**Files:**
- Create: `components/chat/ReplyQuote.tsx`
- Test: `__tests__/components/chat/ReplyQuote.test.tsx`

**Interfaces:**
- Consumes: `ReplyParent` from `@/lib/chat/types`.
- Produces:

```ts
export type ReplyQuoteProps = {
  parent: ReplyParent | null      // null = parent could not be loaded
  senderName: string
  variant: 'composer' | 'bubble'
  mine?: boolean                  // bubble variant only, for colour
  onCancel?: () => void           // composer variant only
  onJump?: () => void             // bubble variant only; omit to render non-tappable
}
```

- [ ] **Step 1: Write the failing test**

Create `__tests__/components/chat/ReplyQuote.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { ReplyQuote } from '@/components/chat/ReplyQuote'
import type { ReplyParent } from '@/lib/chat/types'

const parent: ReplyParent = {
  id: 'm1',
  sender_id: 'u2',
  body: 'Training moved to 6pm',
  attachment_kind: null,
  deleted_at: null,
}

describe('ReplyQuote', () => {
  it('shows the sender name and an excerpt', () => {
    render(<ReplyQuote parent={parent} senderName="Coach Phil" variant="bubble" />)
    expect(screen.getByText('Coach Phil')).toBeInTheDocument()
    expect(screen.getByText('Training moved to 6pm')).toBeInTheDocument()
  })

  it('shows a deleted stub when the parent was soft-deleted', () => {
    render(
      <ReplyQuote
        parent={{ ...parent, deleted_at: '2026-09-21T18:00:00.000Z' }}
        senderName="Coach Phil"
        variant="bubble"
      />
    )
    expect(screen.getByText('Message deleted')).toBeInTheDocument()
    expect(screen.queryByText('Training moved to 6pm')).not.toBeInTheDocument()
  })

  it('shows a deleted stub when the parent could not be loaded at all', () => {
    render(<ReplyQuote parent={null} senderName="" variant="bubble" />)
    expect(screen.getByText('Message deleted')).toBeInTheDocument()
  })

  it('describes an attachment-only parent instead of showing a blank line', () => {
    render(
      <ReplyQuote
        parent={{ ...parent, body: null, attachment_kind: 'image' }}
        senderName="Coach Phil"
        variant="bubble"
      />
    )
    expect(screen.getByText('Photo')).toBeInTheDocument()
  })

  it('calls onCancel from the composer variant', () => {
    const onCancel = jest.fn()
    render(
      <ReplyQuote parent={parent} senderName="Coach Phil" variant="composer" onCancel={onCancel} />
    )
    fireEvent.click(screen.getByLabelText('Cancel reply'))
    expect(onCancel).toHaveBeenCalled()
  })

  it('is tappable in the bubble variant only when onJump is given', () => {
    const onJump = jest.fn()
    const { rerender } = render(
      <ReplyQuote parent={parent} senderName="Coach Phil" variant="bubble" onJump={onJump} />
    )
    fireEvent.click(screen.getByRole('button', { name: /Coach Phil/ }))
    expect(onJump).toHaveBeenCalled()

    rerender(<ReplyQuote parent={parent} senderName="Coach Phil" variant="bubble" />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/components/chat/ReplyQuote.test.tsx`
Expected: FAIL — cannot find module `@/components/chat/ReplyQuote`

- [ ] **Step 3: Write the implementation**

Create `components/chat/ReplyQuote.tsx`:

```tsx
'use client'

import { X } from 'lucide-react'
import type { ReplyParent } from '@/lib/chat/types'

export type ReplyQuoteProps = {
  parent: ReplyParent | null
  senderName: string
  variant: 'composer' | 'bubble'
  mine?: boolean
  onCancel?: () => void
  onJump?: () => void
}

/** One line describing the quoted message. A parent that is missing or
 *  soft-deleted reads "Message deleted" rather than rendering an empty
 *  quote — the row still exists but every normal read filters it out. */
function excerpt(parent: ReplyParent | null): string {
  if (!parent || parent.deleted_at) return 'Message deleted'
  if (parent.body?.trim()) return parent.body.trim()
  if (parent.attachment_kind === 'image') return 'Photo'
  if (parent.attachment_kind === 'file') return 'Attachment'
  return 'Message deleted'
}

export function ReplyQuote({ parent, senderName, variant, mine, onCancel, onJump }: ReplyQuoteProps) {
  const text = excerpt(parent)
  const gone = text === 'Message deleted'

  const body = (
    <span className="flex flex-col items-start text-left min-w-0 w-full">
      {senderName && <span className="text-[10px] font-semibold opacity-80">{senderName}</span>}
      <span className={`text-[11px] truncate max-w-full ${gone ? 'italic opacity-60' : 'opacity-80'}`}>
        {text}
      </span>
    </span>
  )

  if (variant === 'composer') {
    return (
      <div className="bg-white border-t px-3 py-2 flex items-center gap-2 shrink-0">
        <div className="border-l-2 border-tranmere-blue pl-2 flex-1 min-w-0 text-gray-700">{body}</div>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel reply"
          className="ml-auto text-gray-400 hover:text-gray-600 shrink-0"
        >
          <X size={16} />
        </button>
      </div>
    )
  }

  const className = `border-l-2 pl-2 mb-1 w-full block ${
    mine ? 'border-white/50 text-white' : 'border-tranmere-blue/50 text-gray-700'
  }`

  if (!onJump) return <div className={className}>{body}</div>

  return (
    <button type="button" onClick={onJump} className={className}>
      {body}
    </button>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/components/chat/ReplyQuote.test.tsx`
Expected: PASS, 6 tests

- [ ] **Step 5: Commit**

```bash
git add components/chat/ReplyQuote.tsx __tests__/components/chat/ReplyQuote.test.tsx
git commit -m "feat(chat): ReplyQuote component

Handles the two cases that otherwise render a blank quote: a
soft-deleted parent, and a parent outside the loaded 100-message window
that could not be fetched.

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

## Task 5: Reply action in the sheet, and reply state in the thread

**Files:**
- Modify: `components/chat/MessageReactionSheet.tsx`
- Modify: `components/chat/MessageBubble.tsx`
- Modify: `app/chat/[roomId]/ChatThread.tsx`
- Modify: `app/chat/[roomId]/page.tsx`
- Test: `__tests__/components/chat/chatReply.test.tsx`

**Interfaces:**
- Consumes: `ReplyQuote` (Task 4), `ReplyParent`, `ChatMessage` (Task 2), `MessageBubbleProps` (Task 3).
- Produces: `MessageReactionSheet` gains `onReply: () => void`. `MessageBubbleProps` gains `replyParent: ReplyParent | null`, `replyParentName: string`, `onJumpToMessage?: (messageId: string) => void`. `ChatThread` gains `initialReplyParents: ReplyParent[]`.

- [ ] **Step 1: Write the failing test**

Create `__tests__/components/chat/chatReply.test.tsx`. Reuse the supabase and channel mocks from `__tests__/components/chat/ChatThread.test.tsx` verbatim — copy that file's mock block, then add the `insert` capture below.

```tsx
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { ChatThread } from '@/app/chat/[roomId]/ChatThread'
import type { ChatMessage, ReplyParent } from '@/lib/chat/types'

// ...copy the Element.prototype.scrollTo shim, the '@/app/chat/actions'
// mock, and the channelMock block from ChatThread.test.tsx...

const insertMock = jest.fn(() => ({
  select: () => ({ single: () => Promise.resolve({ data: null, error: null }) }),
}))

const messages: ChatMessage[] = [
  { id: 'm1', sender_id: 'u2', body: 'Training moved to 6pm', attachment_url: null, attachment_kind: null, created_at: '2026-09-21T17:00:00.000Z', reply_to_id: null, poll_id: null },
  { id: 'm2', sender_id: 'student-1', body: 'Got it', attachment_url: null, attachment_kind: null, created_at: '2026-09-21T17:01:00.000Z', reply_to_id: 'm1', poll_id: null },
]

const members = [
  { user_id: 'u2', users: { id: 'u2', name: 'Coach Phil', avatar_url: null } },
  { user_id: 'student-1', users: { id: 'student-1', name: 'Alfie', avatar_url: null } },
]

function renderThread(extra: Partial<React.ComponentProps<typeof ChatThread>> = {}) {
  return render(
    <ChatThread
      roomId="room-1"
      roomKind="custom"
      currentUserId="student-1"
      initialMessages={messages}
      initialReactions={[]}
      initialReplyParents={[]}
      members={members as any}
      {...extra}
    />
  )
}

describe('chat replies', () => {
  beforeEach(() => insertMock.mockClear())

  it('renders the quote from a parent inside the loaded window', async () => {
    await act(async () => { renderThread() })
    expect(screen.getByText('Training moved to 6pm')).toBeInTheDocument()
    // The quote repeats the parent body, so it appears twice: once as the
    // original message, once inside m2's quote strip.
    expect(screen.getAllByText('Training moved to 6pm')).toHaveLength(2)
  })

  it('renders a quote for a parent outside the window from initialReplyParents', async () => {
    const older: ReplyParent = { id: 'm0', sender_id: 'u2', body: 'Old news', attachment_kind: null, deleted_at: null }
    await act(async () => {
      renderThread({
        initialMessages: [{ ...messages[1], reply_to_id: 'm0' }],
        initialReplyParents: [older],
      })
    })
    expect(screen.getByText('Old news')).toBeInTheDocument()
  })

  it('renders the deleted stub when the parent was soft-deleted', async () => {
    const deleted: ReplyParent = { id: 'm0', sender_id: 'u2', body: 'Old news', attachment_kind: null, deleted_at: '2026-09-21T18:00:00.000Z' }
    await act(async () => {
      renderThread({
        initialMessages: [{ ...messages[1], reply_to_id: 'm0' }],
        initialReplyParents: [deleted],
      })
    })
    expect(screen.getByText('Message deleted')).toBeInTheDocument()
  })

  it('sends reply_to_id when replying, and clears the composer stub after', async () => {
    await act(async () => { renderThread() })
    fireEvent.click(screen.getAllByLabelText('React to message')[0])
    fireEvent.click(screen.getByText('Reply'))

    // Composer now shows the quoted stub with a cancel affordance.
    expect(screen.getByLabelText('Cancel reply')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('Message…'), { target: { value: 'On my way' } })
    fireEvent.click(screen.getByLabelText('Send message'))

    await waitFor(() =>
      expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ reply_to_id: 'm1' }))
    )
    await waitFor(() => expect(screen.queryByLabelText('Cancel reply')).not.toBeInTheDocument())
  })

  it('cancels a pending reply without sending', async () => {
    await act(async () => { renderThread() })
    fireEvent.click(screen.getAllByLabelText('React to message')[0])
    fireEvent.click(screen.getByText('Reply'))
    fireEvent.click(screen.getByLabelText('Cancel reply'))
    expect(screen.queryByLabelText('Cancel reply')).not.toBeInTheDocument()
    expect(insertMock).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/components/chat/chatReply.test.tsx`
Expected: FAIL — `initialReplyParents` is not a known prop, and there is no `Reply` control.

- [ ] **Step 3: Add the Reply action to the sheet**

In `components/chat/MessageReactionSheet.tsx`, add `onReply: () => void` to the props and render it above the existing Delete button, shown for every message (not only your own):

```tsx
<button
  type="button"
  onClick={onReply}
  className="w-full border-t border-white/10 px-4 py-3 text-left text-sm font-medium"
>
  Reply
</button>
```

The existing `{mine && ...}` Delete button stays below it, unchanged.

- [ ] **Step 4: Render the quote inside the bubble**

Add `replyParent: ReplyParent | null`, `replyParentName: string` and `onJumpToMessage?: (messageId: string) => void` to `MessageBubbleProps`. Render immediately above the attachment/body block:

```tsx
{message.reply_to_id && (
  <ReplyQuote
    parent={replyParent}
    senderName={replyParentName}
    variant="bubble"
    mine={mine}
    onJump={onJumpToMessage && replyParent && !replyParent.deleted_at
      ? () => onJumpToMessage(replyParent.id)
      : undefined}
  />
)}
```

- [ ] **Step 5: Wire reply state into ChatThread**

Add the `initialReplyParents: ReplyParent[]` prop and this state:

```tsx
const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null)
const [replyParents, setReplyParents] = useState<Record<string, ReplyParent>>(
  Object.fromEntries(initialReplyParents.map(p => [p.id, p]))
)
```

Resolve a parent from the loaded window first, then the fetched map:

```tsx
function parentFor(message: ChatMessage): ReplyParent | null {
  if (!message.reply_to_id) return null
  const inWindow = messages.find(m => m.id === message.reply_to_id)
  if (inWindow) {
    return { id: inWindow.id, sender_id: inWindow.sender_id, body: inWindow.body,
             attachment_kind: inWindow.attachment_kind, deleted_at: null }
  }
  return replyParents[message.reply_to_id] ?? null
}
```

Lazily fetch a parent that arrives over realtime and is in neither place:

```tsx
useEffect(() => {
  const missing = messages
    .map(m => m.reply_to_id)
    .filter((id): id is string =>
      !!id && !messages.some(m => m.id === id) && !replyParents[id])
  if (missing.length === 0) return
  let cancelled = false
  supabase
    .from('chat_messages')
    .select('id, sender_id, body, attachment_kind, deleted_at')
    .in('id', missing)
    .then(({ data }) => {
      if (cancelled || !data) return
      setReplyParents(prev => ({
        ...prev,
        ...Object.fromEntries((data as ReplyParent[]).map(p => [p.id, p])),
      }))
    })
  return () => { cancelled = true }
}, [messages, replyParents, supabase])
```

Pass `onReply={() => { setReplyingTo(messages.find(m => m.id === reactingTo) ?? null); setReactingTo(null) }}` to the sheet, render `<ReplyQuote variant="composer" ... onCancel={() => setReplyingTo(null)} />` directly above the composer row, include `reply_to_id: replyingTo?.id ?? null` in the `send()` insert payload, and `setReplyingTo(null)` after a successful send.

Add `aria-label="Send message"` to the send button — it currently has none, and the test selects it by that label.

For `onJumpToMessage`, scroll the target into view and flash it:

```tsx
function jumpToMessage(messageId: string) {
  const el = document.getElementById(`msg-${messageId}`)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  el.classList.add('ring-2', 'ring-tranmere-blue')
  window.setTimeout(() => el.classList.remove('ring-2', 'ring-tranmere-blue'), 1200)
}
```

Give each bubble `id={`msg-${message.id}`}` in `MessageBubble`.

- [ ] **Step 6: Fetch reply parents on the server**

In `app/chat/[roomId]/page.tsx`, after `const messages = ...`, add:

```tsx
// A reply can point outside the 100-message window. Without this fetch the
// quote renders blank for anything older.
const windowIds = new Set(messages.map((m: any) => m.id))
const missingParentIds = Array.from(new Set(
  messages
    .map((m: any) => m.reply_to_id)
    .filter((id: string | null): id is string => !!id && !windowIds.has(id))
))

let replyParents: ReplyParent[] = []
if (missingParentIds.length) {
  const { data } = await admin
    .from('chat_messages')
    .select('id, sender_id, body, attachment_kind, deleted_at')
    .in('id', missingParentIds)
  replyParents = (data ?? []) as ReplyParent[]
}
```

Add `reply_to_id, poll_id` to the existing `chat_messages` select list, and pass `initialReplyParents={replyParents}` to `ChatThread`.

- [ ] **Step 7: Run the tests**

Run: `npx jest __tests__/components/chat/`
Expected: PASS — the new reply tests plus the untouched ChatThread, MessageBubble and ReplyQuote tests.

- [ ] **Step 8: Commit**

```bash
git add components/chat/MessageReactionSheet.tsx components/chat/MessageBubble.tsx "app/chat/[roomId]/ChatThread.tsx" "app/chat/[roomId]/page.tsx" __tests__/components/chat/chatReply.test.tsx
git commit -m "feat(chat): reply to a specific message

Reply joins the existing long-press sheet rather than adding a second
gesture. The server page fetches reply parents that fall outside the
100-message window, and soft-deleted parents render a stub instead of an
empty quote.

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

## Task 6: Reply push notification

**Files:**
- Modify: `app/chat/actions.ts` (`notifyRoomMembers`, currently line 297)
- Modify: `app/chat/[roomId]/ChatThread.tsx` (the `send()` call site)
- Test: `__tests__/lib/chat/replyNotification.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `notifyRoomMembers(roomId: string, senderName: string, preview: string, replyToUserId?: string): Promise<void>` — the fourth parameter is new and optional, so existing call sites are unaffected.

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/chat/replyNotification.test.ts`. Model the admin-client mock on `__tests__/lib/chat/chatNativePush.test.ts`, which already covers this function's web+FCM fan-out.

```ts
/** @jest-environment node */
import { notifyRoomMembers } from '@/app/chat/actions'

const sendPushMock = jest.fn(() => Promise.resolve())
const sendFcmBatchMock = jest.fn(() => Promise.resolve())

jest.mock('@/lib/push', () => ({
  sendPushNotification: (...a: any[]) => sendPushMock(...a),
  sendFcmBatch: (...a: any[]) => sendFcmBatchMock(...a),
}))

// ...admin/server client mocks: room members u2 and u3, a web push
// subscription and a native token for each, sender 'u1' named 'Coach Phil'...

describe('notifyRoomMembers reply targeting', () => {
  beforeEach(() => { sendPushMock.mockClear(); sendFcmBatchMock.mockClear() })

  it('titles every push with the sender name when no reply target is given', async () => {
    await notifyRoomMembers('room-1', 'ignored', 'On my way')
    for (const call of sendPushMock.mock.calls) {
      expect(call[1].title).toBe('Coach Phil')
    }
  })

  it('titles the replied-to user differently from everyone else', async () => {
    await notifyRoomMembers('room-1', 'ignored', 'On my way', 'u2')

    const titlesByEndpoint = Object.fromEntries(
      sendPushMock.mock.calls.map(c => [c[0].endpoint, c[1].title])
    )
    expect(titlesByEndpoint['endpoint-u2']).toBe('Coach Phil replied to you')
    expect(titlesByEndpoint['endpoint-u3']).toBe('Coach Phil')
  })

  it('still sends native FCM to both groups', async () => {
    await notifyRoomMembers('room-1', 'ignored', 'On my way', 'u2')
    const allTokens = sendFcmBatchMock.mock.calls.flatMap(c => c[0])
    expect(allTokens).toEqual(expect.arrayContaining(['token-u2', 'token-u3']))
  })

  it('ignores a reply target who is not in the room', async () => {
    await notifyRoomMembers('room-1', 'ignored', 'On my way', 'stranger')
    for (const call of sendPushMock.mock.calls) {
      expect(call[1].title).toBe('Coach Phil')
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/lib/chat/replyNotification.test.ts`
Expected: FAIL — the reply-target test sees `'Coach Phil'` for both endpoints.

- [ ] **Step 3: Implement the split**

In `notifyRoomMembers`, replace the single-`notification` fan-out with two groups. Keep the existing server-side name derivation and the room-membership guard exactly as they are.

```ts
export async function notifyRoomMembers(
  roomId: string,
  _senderName: string,
  preview: string,
  replyToUserId?: string,
): Promise<void> {
  // ...existing auth, membership guard, member fetch and senderName lookup...

  const otherIds = members.map(m => m.user_id)
  // Only honour a reply target who is actually in the room.
  const replyTarget = replyToUserId && otherIds.includes(replyToUserId) ? replyToUserId : null
  const plainIds = otherIds.filter(id => id !== replyTarget)

  const body = preview.slice(0, 100)
  const url = `/chat/${roomId}`
  const groups: { ids: string[]; title: string }[] = [
    { ids: plainIds, title: senderName },
    ...(replyTarget ? [{ ids: [replyTarget], title: `${senderName} replied to you` }] : []),
  ]

  for (const group of groups) {
    if (group.ids.length === 0) continue
    const notification = { title: group.title, body, url }

    const { data: subs } = await admin
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .in('user_id', group.ids)

    if (subs && subs.length > 0) {
      await Promise.allSettled(subs.map(s => sendPushNotification(
        { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
        notification,
      )))
    }

    const { data: nativeTokens } = await admin
      .from('native_push_tokens')
      .select('token')
      .in('user_id', group.ids)

    const tokens = (nativeTokens ?? []).map(r => r.token as string)
    if (tokens.length > 0) await sendFcmBatch(tokens, notification)
  }
}
```

Both groups go through the same web-push *and* FCM path. Several other push sites in this app send web-only; do not reintroduce that here.

- [ ] **Step 4: Pass the target from the thread**

In `ChatThread.tsx`'s `send()`, change the notify call to:

```tsx
notifyRoomMembers(
  roomId,
  myName ?? 'Someone',
  body || 'Attachment',
  replyingTo && replyingTo.sender_id !== currentUserId ? replyingTo.sender_id : undefined,
).catch(() => {})
```

Replying to yourself must not push you a notification.

- [ ] **Step 5: Run the tests**

Run: `npx jest __tests__/lib/chat/`
Expected: PASS — including the existing `chatNativePush.test.ts`, which guards the FCM fan-out.

- [ ] **Step 6: Commit**

```bash
git add app/chat/actions.ts "app/chat/[roomId]/ChatThread.tsx" __tests__/lib/chat/replyNotification.test.ts
git commit -m "feat(chat): distinct push when someone replies to you

The replied-to member gets 'X replied to you'; everyone else gets the
normal room push. Both groups go through web push AND FCM.

Note chat_members.muted is still not honoured by this path - it never
was, for any chat push. Replies inherit that; fixing mute is separate.

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

## Task 7: Poll server actions

**Files:**
- Modify: `app/chat/actions.ts`
- Test: `__tests__/lib/chat/pollActions.test.ts`

**Interfaces:**
- Consumes: `validatePollInput`, `POLL_MAX_OPTIONS` from `@/lib/chat/types`.
- Produces:

```ts
export async function createPoll(
  roomId: string, question: string, options: string[]
): Promise<{ ok: boolean; error?: string }>

export async function closePoll(pollId: string): Promise<{ ok: boolean; error?: string }>
```

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/chat/pollActions.test.ts`:

```ts
/** @jest-environment node */
import { createPoll } from '@/app/chat/actions'

const CURRENT_USER_ID = 'staff-1'

// The user client is what enforces RLS. createPoll must use it, not the
// admin client, or the staff-only rule rests on a single if statement.
const pollInsertMock = jest.fn()
const optionInsertMock = jest.fn(() => Promise.resolve({ error: null }))
const messageInsertMock = jest.fn(() => Promise.resolve({ error: null }))
const pollDeleteEqMock = jest.fn(() => Promise.resolve({ error: null }))

jest.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: { getUser: () => Promise.resolve({ data: { user: { id: CURRENT_USER_ID } } }) },
    from: (table: string) => {
      if (table === 'chat_polls') {
        return {
          insert: (row: any) => ({
            select: () => ({ single: () => pollInsertMock(row) }),
          }),
          delete: () => ({ eq: pollDeleteEqMock }),
        }
      }
      if (table === 'chat_poll_options') return { insert: optionInsertMock }
      if (table === 'chat_messages') return { insert: messageInsertMock }
      throw new Error(`Unexpected table: ${table}`)
    },
  }),
}))

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/lib/push', () => ({
  sendPushNotification: jest.fn(() => Promise.resolve()),
  sendFcmBatch: jest.fn(() => Promise.resolve()),
}))

const okPoll = { data: { id: 'poll-1' }, error: null }

describe('createPoll', () => {
  beforeEach(() => {
    pollInsertMock.mockReset().mockResolvedValue(okPoll)
    optionInsertMock.mockClear()
    messageInsertMock.mockClear()
    pollDeleteEqMock.mockClear()
  })

  it('creates the poll, its options and the carrier message', async () => {
    const result = await createPoll('room-1', 'Who is coming?', ['Yes', 'No'])
    expect(result).toEqual({ ok: true })
    expect(optionInsertMock).toHaveBeenCalledWith([
      { poll_id: 'poll-1', label: 'Yes', position: 0 },
      { poll_id: 'poll-1', label: 'No', position: 1 },
    ])
    expect(messageInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ room_id: 'room-1', poll_id: 'poll-1', sender_id: CURRENT_USER_ID })
    )
  })

  it('trims and drops blank option rows before inserting', async () => {
    await createPoll('room-1', '  Who is coming?  ', ['  Yes  ', '', 'No', '   '])
    expect(optionInsertMock).toHaveBeenCalledWith([
      { poll_id: 'poll-1', label: 'Yes', position: 0 },
      { poll_id: 'poll-1', label: 'No', position: 1 },
    ])
  })

  it('rejects invalid input before touching the database', async () => {
    const result = await createPoll('room-1', '', ['Yes', 'No'])
    expect(result).toEqual({ ok: false, error: 'Add a question' })
    expect(pollInsertMock).not.toHaveBeenCalled()
  })

  it('surfaces an RLS rejection rather than reporting fake success', async () => {
    // What a student (or a non-member) gets back from the insert policy.
    pollInsertMock.mockResolvedValue({ data: null, error: { message: 'new row violates row-level security policy' } })
    const result = await createPoll('room-1', 'Who is coming?', ['Yes', 'No'])
    expect(result.ok).toBe(false)
    expect(optionInsertMock).not.toHaveBeenCalled()
  })

  it('rolls the poll back when the options insert fails', async () => {
    optionInsertMock.mockResolvedValueOnce({ error: { message: 'boom' } })
    const result = await createPoll('room-1', 'Who is coming?', ['Yes', 'No'])
    expect(result.ok).toBe(false)
    expect(pollDeleteEqMock).toHaveBeenCalledWith('id', 'poll-1')
    expect(messageInsertMock).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/lib/chat/pollActions.test.ts`
Expected: FAIL — `createPoll` is not exported from `@/app/chat/actions`

- [ ] **Step 3: Implement the actions**

Append to `app/chat/actions.ts`:

```ts
/** Create a poll, its options and the carrier chat message.
 *  Uses the USER's client, not the admin client, so the staff-only insert
 *  policy from migration 082 is what actually enforces permission. */
export async function createPoll(
  roomId: string,
  question: string,
  options: string[],
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Unauthorized' }

  const invalid = validatePollInput(question, options)
  if (invalid) return { ok: false, error: invalid }

  const q = question.trim()
  const labels = options.map(o => o.trim()).filter(Boolean)

  const { data: poll, error: pollError } = await supabase
    .from('chat_polls')
    .insert({ room_id: roomId, created_by: user.id, question: q })
    .select('id')
    .single()

  if (pollError || !poll) {
    return { ok: false, error: pollError?.message ?? 'Could not create the poll' }
  }

  const { error: optionsError } = await supabase
    .from('chat_poll_options')
    .insert(labels.map((label, position) => ({ poll_id: poll.id, label, position })))

  // A poll with no options is not a recoverable state — roll it back rather
  // than leaving an empty poll in the timeline.
  if (optionsError) {
    await supabase.from('chat_polls').delete().eq('id', poll.id)
    return { ok: false, error: optionsError.message }
  }

  const { error: messageError } = await supabase
    .from('chat_messages')
    .insert({ room_id: roomId, sender_id: user.id, body: null, poll_id: poll.id })

  if (messageError) {
    await supabase.from('chat_polls').delete().eq('id', poll.id)
    return { ok: false, error: messageError.message }
  }

  await notifyRoomMembers(roomId, '', `📊 ${q}`).catch(() => {})
  revalidatePath(`/chat/${roomId}`)
  return { ok: true }
}

export async function closePoll(pollId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Unauthorized' }

  // Staff-only is enforced by the update policy, not by an if here.
  const { data, error } = await supabase
    .from('chat_polls')
    .update({ closed_at: new Date().toISOString() })
    .eq('id', pollId)
    .select('room_id')
    .maybeSingle()

  if (error) return { ok: false, error: error.message }
  if (!data) return { ok: false, error: 'Poll not found, or you cannot close it' }

  revalidatePath(`/chat/${data.room_id}`)
  return { ok: true }
}
```

Add `import { validatePollInput } from '@/lib/chat/types'` to the top of the file.

Note `closePoll` uses `.maybeSingle()` — an RLS-blocked update returns zero rows rather than an error, and `.single()` would throw a Postgres error on that legitimate case.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/lib/chat/pollActions.test.ts`
Expected: PASS, 5 tests

- [ ] **Step 5: Commit**

```bash
git add app/chat/actions.ts __tests__/lib/chat/pollActions.test.ts
git commit -m "feat(chat): createPoll and closePoll server actions

Both use the user's client so RLS enforces staff-only, rather than a
single if statement. A failed options insert rolls the poll back instead
of leaving an empty poll in the timeline.

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

## Task 8: PollCard

**Files:**
- Create: `components/chat/PollCard.tsx`
- Test: `__tests__/components/chat/PollCard.test.tsx`

**Interfaces:**
- Consumes: `Poll`, `PollOption` from `@/lib/chat/types`.
- Produces:

```ts
export type PollVoter = { userId: string; name: string; optionId: string }

export type PollCardProps = {
  poll: Poll
  options: PollOption[]          // caller sorts by position
  myOptionId: string | null
  isChatStaff: boolean
  voters?: PollVoter[]           // staff only; undefined for students
  busy?: boolean
  onVote: (optionId: string) => void
  onClose: () => void
  onShowVoters?: () => void
}
```

- [ ] **Step 1: Write the failing test**

Create `__tests__/components/chat/PollCard.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { PollCard } from '@/components/chat/PollCard'
import type { Poll, PollOption } from '@/lib/chat/types'

const poll: Poll = {
  id: 'poll-1', room_id: 'room-1', created_by: 'staff-1',
  question: 'Who is coming Saturday?', closed_at: null,
  created_at: '2026-09-21T17:00:00.000Z',
}

const options: PollOption[] = [
  { id: 'o1', poll_id: 'poll-1', label: 'Yes', position: 0, vote_count: 3 },
  { id: 'o2', poll_id: 'poll-1', label: 'No', position: 1, vote_count: 1 },
]

function renderCard(overrides: Partial<React.ComponentProps<typeof PollCard>> = {}) {
  const props = {
    poll, options, myOptionId: null, isChatStaff: false,
    onVote: jest.fn(), onClose: jest.fn(),
    ...overrides,
  }
  render(<PollCard {...props} />)
  return props
}

describe('PollCard', () => {
  it('renders the question, the options and the total', () => {
    renderCard()
    expect(screen.getByText('Who is coming Saturday?')).toBeInTheDocument()
    expect(screen.getByText('Yes')).toBeInTheDocument()
    expect(screen.getByText('4 votes')).toBeInTheDocument()
  })

  it('says "1 vote" rather than "1 votes"', () => {
    renderCard({ options: [{ ...options[0], vote_count: 1 }, { ...options[1], vote_count: 0 }] })
    expect(screen.getByText('1 vote')).toBeInTheDocument()
  })

  it('votes when an option is tapped', () => {
    const props = renderCard()
    fireEvent.click(screen.getByRole('button', { name: /Yes/ }))
    expect(props.onVote).toHaveBeenCalledWith('o1')
  })

  it('marks your current choice', () => {
    renderCard({ myOptionId: 'o2' })
    expect(screen.getByRole('button', { name: /No/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /Yes/ })).toHaveAttribute('aria-pressed', 'false')
  })

  it('disables voting and says so once the poll is closed', () => {
    const props = renderCard({ poll: { ...poll, closed_at: '2026-09-21T18:00:00.000Z' } })
    expect(screen.getByText('Poll closed')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Yes/ }))
    expect(props.onVote).not.toHaveBeenCalled()
  })

  it('shows Close to staff only, and only while the poll is open', () => {
    const { unmount } = render(
      <PollCard {...{ poll, options, myOptionId: null, isChatStaff: false, onVote: jest.fn(), onClose: jest.fn() }} />
    )
    expect(screen.queryByText('Close poll')).not.toBeInTheDocument()
    unmount()

    renderCard({ isChatStaff: true })
    expect(screen.getByText('Close poll')).toBeInTheDocument()
  })

  it('offers the voter list to staff and not to students', () => {
    const { unmount } = render(
      <PollCard {...{ poll, options, myOptionId: null, isChatStaff: false, onVote: jest.fn(), onClose: jest.fn(), onShowVoters: jest.fn() }} />
    )
    expect(screen.queryByText('See who voted')).not.toBeInTheDocument()
    unmount()

    renderCard({ isChatStaff: true, onShowVoters: jest.fn() })
    expect(screen.getByText('See who voted')).toBeInTheDocument()
  })

  it('lists voter names grouped by option when staff have loaded them', () => {
    renderCard({
      isChatStaff: true,
      voters: [
        { userId: 'u1', name: 'Alfie', optionId: 'o1' },
        { userId: 'u2', name: 'Bea', optionId: 'o1' },
        { userId: 'u3', name: 'Cal', optionId: 'o2' },
      ],
    })
    expect(screen.getByText('Alfie, Bea')).toBeInTheDocument()
    expect(screen.getByText('Cal')).toBeInTheDocument()
  })

  it('renders zero-vote options without dividing by zero', () => {
    renderCard({ options: options.map(o => ({ ...o, vote_count: 0 })) })
    expect(screen.getByText('No votes yet')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/components/chat/PollCard.test.tsx`
Expected: FAIL — cannot find module `@/components/chat/PollCard`

- [ ] **Step 3: Write the implementation**

Create `components/chat/PollCard.tsx`. Requirements the tests pin down:

- Each option is a `<button>` with `aria-pressed` reflecting `myOptionId`, `disabled` when `poll.closed_at` is set or `busy` is true, and an accessible name containing the label.
- The bar width is `total === 0 ? 0 : (vote_count / total) * 100` — guard the division.
- Total line reads `No votes yet` at zero, `1 vote` at one, `N votes` otherwise.
- `Poll closed` renders when `poll.closed_at` is set.
- `Close poll` renders only when `isChatStaff && !poll.closed_at`, calling `onClose`.
- `See who voted` renders only when `isChatStaff && onShowVoters && !voters`.
- When `voters` is present, render the names for each option joined with `, ` beneath that option.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/components/chat/PollCard.test.tsx`
Expected: PASS, 9 tests

- [ ] **Step 5: Commit**

```bash
git add components/chat/PollCard.tsx __tests__/components/chat/PollCard.test.tsx
git commit -m "feat(chat): PollCard

Renders options, live tallies and your choice. Voter names are rendered
only when the caller supplies them, which RLS only permits for staff who
are in the room.

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

## Task 9: CreatePollSheet

**Files:**
- Create: `components/chat/CreatePollSheet.tsx`
- Test: `__tests__/components/chat/CreatePollSheet.test.tsx`

**Interfaces:**
- Consumes: `validatePollInput`, `POLL_QUESTION_MAX`, `POLL_OPTION_MAX`, `POLL_MIN_OPTIONS`, `POLL_MAX_OPTIONS` from `@/lib/chat/types`.
- Produces:

```ts
export type CreatePollSheetProps = {
  onSubmit: (question: string, options: string[]) => Promise<{ ok: boolean; error?: string }>
  onClose: () => void
}
```

- [ ] **Step 1: Write the failing test**

Create `__tests__/components/chat/CreatePollSheet.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CreatePollSheet } from '@/components/chat/CreatePollSheet'
import { POLL_QUESTION_MAX, POLL_OPTION_MAX, POLL_MAX_OPTIONS } from '@/lib/chat/types'

describe('CreatePollSheet', () => {
  it('caps the question and option fields at their column limits', () => {
    render(<CreatePollSheet onSubmit={jest.fn()} onClose={jest.fn()} />)
    expect(screen.getByLabelText('Question')).toHaveAttribute('maxLength', String(POLL_QUESTION_MAX))
    expect(screen.getByLabelText('Option 1')).toHaveAttribute('maxLength', String(POLL_OPTION_MAX))
  })

  it('shows a character counter for the question', () => {
    render(<CreatePollSheet onSubmit={jest.fn()} onClose={jest.fn()} />)
    fireEvent.change(screen.getByLabelText('Question'), { target: { value: 'Who?' } })
    expect(screen.getByText(`4/${POLL_QUESTION_MAX}`)).toBeInTheDocument()
  })

  it('starts with two option rows and adds more up to the maximum', () => {
    render(<CreatePollSheet onSubmit={jest.fn()} onClose={jest.fn()} />)
    expect(screen.getByLabelText('Option 2')).toBeInTheDocument()
    expect(screen.queryByLabelText('Option 3')).not.toBeInTheDocument()

    for (let i = 3; i <= POLL_MAX_OPTIONS; i++) {
      fireEvent.click(screen.getByText('Add option'))
    }
    expect(screen.getByLabelText(`Option ${POLL_MAX_OPTIONS}`)).toBeInTheDocument()
    expect(screen.queryByText('Add option')).not.toBeInTheDocument()
  })

  it('blocks submission and explains why when input is invalid', async () => {
    const onSubmit = jest.fn()
    render(<CreatePollSheet onSubmit={onSubmit} onClose={jest.fn()} />)
    fireEvent.click(screen.getByText('Post poll'))
    expect(await screen.findByText('Add a question')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits trimmed values and closes on success', async () => {
    const onSubmit = jest.fn(() => Promise.resolve({ ok: true }))
    const onClose = jest.fn()
    render(<CreatePollSheet onSubmit={onSubmit} onClose={onClose} />)
    fireEvent.change(screen.getByLabelText('Question'), { target: { value: '  Who is coming?  ' } })
    fireEvent.change(screen.getByLabelText('Option 1'), { target: { value: ' Yes ' } })
    fireEvent.change(screen.getByLabelText('Option 2'), { target: { value: 'No' } })
    fireEvent.click(screen.getByText('Post poll'))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('Who is coming?', ['Yes', 'No']))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('shows the server error and stays open when submission fails', async () => {
    const onSubmit = jest.fn(() => Promise.resolve({ ok: false, error: 'Only staff can post polls' }))
    const onClose = jest.fn()
    render(<CreatePollSheet onSubmit={onSubmit} onClose={onClose} />)
    fireEvent.change(screen.getByLabelText('Question'), { target: { value: 'Who is coming?' } })
    fireEvent.change(screen.getByLabelText('Option 1'), { target: { value: 'Yes' } })
    fireEvent.change(screen.getByLabelText('Option 2'), { target: { value: 'No' } })
    fireEvent.click(screen.getByText('Post poll'))

    expect(await screen.findByText('Only staff can post polls')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/components/chat/CreatePollSheet.test.tsx`
Expected: FAIL — cannot find module `@/components/chat/CreatePollSheet`

- [ ] **Step 3: Write the implementation**

Create `components/chat/CreatePollSheet.tsx`, matching `MessageReactionSheet`'s visual language (fixed overlay, `bg-black/40` backdrop, rounded dark panel, bottom-anchored on mobile).

Every text field carries an explicit `maxLength` and a visible counter. This app has a recurring bug where a name-style input without `maxLength` silently truncates at the database boundary with the overflow invisible — do not ship this form without them.

- State: `question: string`, `options: string[]` starting `['', '']`, `error: string | null`, `busy: boolean`.
- `Add option` appears only while `options.length < POLL_MAX_OPTIONS`.
- On submit: run `validatePollInput` first and set `error` on failure without calling `onSubmit`; otherwise call `onSubmit(question.trim(), options)` and, on `{ ok: false }`, show `error` and stay open.
- Labels must be exactly `Question`, `Option 1`, `Option 2`… — the tests select on them, and they are what a screen reader announces.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/components/chat/CreatePollSheet.test.tsx`
Expected: PASS, 6 tests

- [ ] **Step 5: Commit**

```bash
git add components/chat/CreatePollSheet.tsx __tests__/components/chat/CreatePollSheet.test.tsx
git commit -m "feat(chat): CreatePollSheet

Explicit maxLength plus a visible counter on every field - this is the
exact input shape that has silently truncated at the DB boundary
elsewhere in this app.

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

## Task 10: Wire polls into the thread

**Files:**
- Modify: `app/chat/[roomId]/page.tsx`
- Modify: `app/chat/[roomId]/ChatThread.tsx`
- Modify: `components/chat/MessageBubble.tsx`
- Test: `__tests__/components/chat/chatPolls.test.tsx`

**Interfaces:**
- Consumes: `PollCard` (Task 8), `CreatePollSheet` (Task 9), `createPoll`/`closePoll` (Task 7), types (Task 2).
- Produces: `ChatThread` gains `initialPolls: Poll[]`, `initialPollOptions: PollOption[]`, `initialMyVotes: PollVote[]`, `isChatStaff: boolean`. `MessageBubbleProps` gains `pollSlot?: React.ReactNode`, rendered in place of the body when present.

- [ ] **Step 1: Write the failing test**

Create `__tests__/components/chat/chatPolls.test.tsx`. Reuse the supabase/channel mock block from `ChatThread.test.tsx`, extended to accept `chat_poll_votes` upserts.

```tsx
// ...mock block, extended with:
//   chat_poll_votes: { upsert: voteUpsertMock, delete: () => ({ eq: ... }) }
// and a channelMock whose `on` handlers are captured so the test can fire a
// chat_poll_options UPDATE payload.

describe('polls in the thread', () => {
  it('renders a poll message as a PollCard instead of a text bubble', async () => {
    await act(async () => { renderThreadWithPoll() })
    expect(screen.getByText('Who is coming Saturday?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Yes/ })).toBeInTheDocument()
  })

  it('upserts a vote keyed on poll_id and user_id when an option is tapped', async () => {
    await act(async () => { renderThreadWithPoll() })
    fireEvent.click(screen.getByRole('button', { name: /Yes/ }))
    await waitFor(() => expect(voteUpsertMock).toHaveBeenCalledWith(
      { poll_id: 'poll-1', option_id: 'o1', user_id: 'student-1' },
      { onConflict: 'poll_id,user_id' },
    ))
  })

  it('updates the tally live from a chat_poll_options realtime UPDATE', async () => {
    await act(async () => { renderThreadWithPoll() })
    expect(screen.getByText('1 vote')).toBeInTheDocument()
    await act(async () => {
      fireePollOptionsUpdate({ id: 'o1', poll_id: 'poll-1', label: 'Yes', position: 0, vote_count: 5 })
    })
    expect(screen.getByText('5 votes')).toBeInTheDocument()
  })

  it('shows the New poll control to staff only', async () => {
    await act(async () => { renderThreadWithPoll({ isChatStaff: false }) })
    expect(screen.queryByLabelText('New poll')).not.toBeInTheDocument()
  })

  it('lets a student in a broadcast room vote even though they cannot post', async () => {
    await act(async () => { renderThreadWithPoll({ roomKind: 'broadcast', canSend: false }) })
    expect(screen.getByText(/only staff can post/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Yes/ }))
    await waitFor(() => expect(voteUpsertMock).toHaveBeenCalled())
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/components/chat/chatPolls.test.tsx`
Expected: FAIL — `initialPolls` is not a known prop

- [ ] **Step 3: Fetch poll data on the server**

In `app/chat/[roomId]/page.tsx`, after the reactions fetch:

```tsx
const pollIds = messages
  .map((m: any) => m.poll_id)
  .filter((id: string | null): id is string => !!id)

let polls: Poll[] = []
let pollOptions: PollOption[] = []
let myVotes: PollVote[] = []

if (pollIds.length) {
  const [{ data: pollRows }, { data: optionRows }, { data: voteRows }] = await Promise.all([
    admin.from('chat_polls').select('*').in('id', pollIds),
    admin.from('chat_poll_options').select('*').in('poll_id', pollIds).order('position'),
    admin.from('chat_poll_votes').select('id, poll_id, option_id, user_id')
      .in('poll_id', pollIds).eq('user_id', user.id),
  ])
  polls = (pollRows ?? []) as Poll[]
  pollOptions = (optionRows ?? []) as PollOption[]
  myVotes = (voteRows ?? []) as PollVote[]
}
```

Only the viewer's own votes are fetched here. Staff load the full voter list on demand from the client, where their RLS policy applies — the page uses the admin client, which bypasses RLS, so fetching everyone's votes here would leak them to students.

Pass `initialPolls`, `initialPollOptions`, `initialMyVotes` and `isChatStaff={!!isStaff}` to `ChatThread`.

- [ ] **Step 4: Wire poll state and realtime into ChatThread**

Add the four props and this state:

```tsx
const [polls, setPolls] = useState<Poll[]>(initialPolls)
const [pollOptions, setPollOptions] = useState<PollOption[]>(initialPollOptions)
const [myVotes, setMyVotes] = useState<PollVote[]>(initialMyVotes)
const [creatingPoll, setCreatingPoll] = useState(false)
```

Add two subscriptions to the existing channel chain, beside the reaction handlers:

```tsx
.on('postgres_changes', { event: '*', schema: 'public', table: 'chat_poll_options' }, payload => {
  const row = payload.new as PollOption
  if (!row?.id) return
  setPollOptions(prev => prev.map(o => (o.id === row.id ? row : o)))
})
.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_polls' }, payload => {
  const row = payload.new as Poll
  setPolls(prev => prev.map(p => (p.id === row.id ? row : p)))
})
```

Voting, optimistic so the bar moves before the round-trip:

```tsx
async function vote(pollId: string, optionId: string) {
  const previous = myVotes.find(v => v.poll_id === pollId) ?? null
  if (previous?.option_id === optionId) return

  setMyVotes(prev => [
    ...prev.filter(v => v.poll_id !== pollId),
    { id: previous?.id ?? `local-${pollId}`, poll_id: pollId, option_id: optionId, user_id: currentUserId },
  ])

  const { error } = await supabase
    .from('chat_poll_votes')
    .upsert(
      { poll_id: pollId, option_id: optionId, user_id: currentUserId },
      { onConflict: 'poll_id,user_id' },
    )

  if (error) {
    // Roll the optimistic change back — a closed poll rejects the write.
    setMyVotes(prev => (previous
      ? [...prev.filter(v => v.poll_id !== pollId), previous]
      : prev.filter(v => v.poll_id !== pollId)))
    alert(`Could not record your vote: ${error.message}`)
  }
}
```

Staff voter list, loaded on demand:

```tsx
async function loadVoters(pollId: string) {
  const { data } = await supabase
    .from('chat_poll_votes')
    .select('user_id, option_id')
    .eq('poll_id', pollId)
  if (!data) return
  setVotersByPoll(prev => ({
    ...prev,
    [pollId]: data.map(v => ({
      userId: v.user_id,
      name: memberById[v.user_id]?.users?.name ?? 'Unknown',
      optionId: v.option_id,
    })),
  }))
}
```

Render a `BarChart3` button beside the paperclip, `aria-label="New poll"`, shown only when `isChatStaff`, opening `CreatePollSheet` with `onSubmit={(q, o) => createPoll(roomId, q, o)}`. Render it outside the `canSend` branch so staff can post a poll in a broadcast room.

- [ ] **Step 5: Render the poll in the bubble**

Add `pollSlot?: React.ReactNode` to `MessageBubbleProps` and render it in place of the `MessageBody` block when present. In `ChatThread`'s map:

```tsx
pollSlot={m.poll_id ? (() => {
  const poll = polls.find(p => p.id === m.poll_id)
  if (!poll) return null
  return (
    <PollCard
      poll={poll}
      options={pollOptions.filter(o => o.poll_id === poll.id).sort((a, b) => a.position - b.position)}
      myOptionId={myVotes.find(v => v.poll_id === poll.id)?.option_id ?? null}
      isChatStaff={isChatStaff}
      voters={votersByPoll[poll.id]}
      onVote={optionId => vote(poll.id, optionId)}
      onClose={() => closePoll(poll.id)}
      onShowVoters={() => loadVoters(poll.id)}
    />
  )
})() : undefined}
```

A poll bubble should render at full width, not the `max-w-[75%]` text bubble width — widen the bubble class when `pollSlot` is present.

- [ ] **Step 6: Run the tests**

Run: `npx jest __tests__/components/chat/`
Expected: PASS — every chat component suite.

- [ ] **Step 7: Commit**

```bash
git add "app/chat/[roomId]/page.tsx" "app/chat/[roomId]/ChatThread.tsx" components/chat/MessageBubble.tsx __tests__/components/chat/chatPolls.test.tsx
git commit -m "feat(chat): polls in the message thread

Polls render as a card inside their carrier message. Tallies update live
from chat_poll_options; vote rows are never published to realtime.

The New poll control sits outside the canSend branch so staff can poll a
broadcast room, and voting is gated on room membership rather than the
send rule so students can vote there.

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

## Task 11: Full verification and merge

**Files:** none modified unless a check fails.

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: PASS, no regressions outside chat.

- [ ] **Step 2: Real build**

Run: `npm run build`
Expected: PASS. This is not optional — `next.config.js` ignores lint and typecheck during builds, so a `react/no-unescaped-entities` error can pass `tsc` and Jest and still fail on Vercel. Apostrophes in new copy are the usual culprit.

- [ ] **Step 3: Lint and typecheck explicitly**

```bash
npm run lint
npx tsc --noEmit
```
Expected: clean.

- [ ] **Step 4: Re-verify the production schema**

Re-run the six verification queries from Task 1 Step 3. The app now depends on them; confirm nothing was rolled back or lost between then and now.

- [ ] **Step 5: Manual smoke test against the dev server**

Start the dev server and check, as a staff account:
1. Long-press a message → Reply → the quote appears above the composer → send → the quote renders in the sent bubble.
2. Tap a quote on a reply → the thread scrolls to the original and flashes it.
3. Delete a message that has a reply → the reply shows "Message deleted".
4. New poll → post a 3-option poll → it appears in the timeline.
5. Vote, then change your vote → the bars move and the total stays correct.
6. "See who voted" → names appear grouped by option.
7. Close the poll → voting is disabled and "Poll closed" shows.

Then as a student account in the same room: the tallies are visible and live, no names are shown, and there is no New poll control.

- [ ] **Step 6: Open the PR**

```bash
git push -u origin HEAD
gh pr create --title "feat(chat): reply to a message, and polls" --body "$(cat <<'BODY'
Implements docs/superpowers/specs/2026-09-21-chat-replies-and-polls-design.md

- Reply to a specific message, via the existing long-press sheet
- Staff-created single-choice polls with live tallies
- Migration 082, applied and verified against production

Vote privacy is enforced in RLS: students can read only their own vote
row. Tallies live in chat_poll_options.vote_count, maintained by a
trigger, and it is that table — not the vote rows — that is published to
realtime.

Adds is_chat_staff() because public.is_staff() covers admin+coach only
while the chat layer already treats teacher as staff.

Flagged, not fixed: the broadcast read-only rule is UI-only. Migration
011's insert policy has no room-kind check, so a student could post to a
broadcast room via the API today. Polls do not inherit that weakness.

🤖 Generated with [claude-flow](https://github.com/ruvnet/claude-flow)
BODY
)"
```

---

## Self-Review

**Spec coverage**

| Spec section | Task |
|---|---|
| §3 poll-as-message | 1 (schema), 10 (rendering) |
| §4 schema, limits, indexes | 1, 2 |
| §5 vote privacy, `is_chat_staff()`, trigger, RLS | 1 |
| §6 replies, parents outside window, deleted parents | 4, 5 |
| §7 reply push, both transports | 6 |
| §8 input limits | 2 (validation), 9 (maxLength + counters) |
| §9 server actions vs client inserts | 7 (actions), 10 (client vote upsert) |
| §10 components | 3, 4, 8, 9 |
| §11 MessageBubble extraction | 3 |
| §12 testing | every task; 11 runs the suite and `npm run build` |
| §13 migration actually applied | 1 (steps 2–4), 11 (step 4) |

**Corrections made during review**

1. **Vote-read policy widened too far.** The spec's §5 wording, `user_id = auth.uid() or public.is_staff()`, would let any coach or teacher read every vote in every room — including rooms they have never joined, since the helper is global. Task 1 requires `is_chat_staff() and is_poll_room_member(poll_id)`.
2. **`closePoll` needs `.maybeSingle()`.** An RLS-blocked update returns zero rows rather than an error; `.single()` would throw on that legitimate case.
3. **Staff voter lists must not be fetched on the server page.** `page.tsx` uses the admin client, which bypasses RLS entirely — fetching all votes there would ship them to students in the initial payload regardless of the policies. Task 10 loads voters client-side, where the policy applies.
4. **`chat_poll_votes` is excluded from the realtime publication.** Counts come from `chat_poll_options`, so publishing the vote rows adds leak surface for nothing.
