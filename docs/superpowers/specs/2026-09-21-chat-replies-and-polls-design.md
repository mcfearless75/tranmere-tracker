# Chat: reply-to-message and polls

**Date:** 2026-09-21
**Status:** Approved design, pending implementation plan

Two additions to the chat feature, built on one branch:

1. **Reply to a specific message** — quote an earlier message when you answer it.
2. **Polls** — staff post a question with options; room members vote; results update live.

---

## 1. Context

The chat feature today (`app/chat/`, migrations `011`, `044`, `073`, `077`, `078`):

- `chat_messages` holds `room_id, sender_id, body, attachment_url, attachment_kind, created_at, deleted_at`. There is no threading column.
- Deletion is **soft** — `deleted_at` is set and every read filters `.is('deleted_at', null)`.
- Reactions (`chat_message_reactions`, migration `073`) already provide a working "act on one specific message" pattern: a 380ms long-press opens a bottom sheet (`components/chat/MessageReactionSheet.tsx`) carrying the emoji row and Delete.
- Realtime is wired per room in `ChatThread.tsx`: message INSERT, message UPDATE (used to remove soft-deleted messages), reaction INSERT/DELETE, and presence for typing indicators.
- `app/chat/[roomId]/page.tsx` server-renders the **last 100 messages** plus the reactions for those messages, using the admin client.
- Room kinds are `dm`, `squad`, `broadcast`, `match`, `custom`. In a `broadcast` room only staff can post; students read only.

## 2. Decisions taken

| Question | Decision |
|---|---|
| Who can create a poll | Staff (`admin`/`coach`/`teacher`) only, in any room they are a member of — see §5 on why this needs a new `is_chat_staff()` helper |
| Who can vote | Any room member, **including students in broadcast rooms** |
| Vote visibility | Staff see who voted for what; students see counts and their own choice |
| Choice mode | Single choice, changeable |
| Closing | Manual close by staff. No deadline, no cron |
| Reply notification | The replied-to sender gets a distinct "replied to you" push |

### Explicitly out of scope

- Multi-choice polls, anonymous polls, scheduled poll deadlines.
- Threaded conversation views. A reply quotes one message; it does not create a sub-thread.
- Replying to or polling inside the AI Coach bot room.
- Honouring `chat_members.muted`. See §7.

---

## 3. Architecture: a poll is a message

**A poll is a `chat_messages` row carrying a `poll_id`**, not a separate entity merged into the timeline on the client.

Alternatives considered:

| Approach | Verdict |
|---|---|
| **A. `chat_messages.poll_id` FK** | **Chosen.** Timeline ordering, realtime delivery, soft delete, replies and reactions all apply to polls with no new code. Costs one join. |
| B. Standalone `chat_polls.room_id`, merged client-side | Rejected. Two streams to merge, two sort orders, two realtime subscriptions, and polls become second-class — not reply-able, not reactable, not deletable by the existing path. |
| C. `jsonb` poll column on `chat_messages` | Rejected. Votes need their own table regardless for per-voter RLS, so the jsonb buys nothing while losing referential integrity and queryability. |

The governing reason for A: the existing message pipeline is the thing B and C would force us to rebuild.

---

## 4. Schema — migration `082_chat_replies_and_polls.sql`

```sql
create table chat_polls (
  id         uuid primary key default uuid_generate_v4(),
  room_id    uuid not null references chat_rooms(id) on delete cascade,
  created_by uuid not null references public.users(id),
  question   text not null,
  closed_at  timestamptz,
  created_at timestamptz default now()
);

create table chat_poll_options (
  id         uuid primary key default uuid_generate_v4(),
  poll_id    uuid not null references chat_polls(id) on delete cascade,
  label      text not null,
  position   int  not null,
  vote_count int  not null default 0
);

create table chat_poll_votes (
  id         uuid primary key default uuid_generate_v4(),
  poll_id    uuid not null references chat_polls(id) on delete cascade,
  option_id  uuid not null references chat_poll_options(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  created_at timestamptz default now(),
  unique (poll_id, user_id)
);

alter table chat_messages
  add column reply_to_id uuid references chat_messages(id) on delete set null,
  add column poll_id     uuid references chat_polls(id)    on delete cascade;
```

`unique (poll_id, user_id)` is what enforces single choice. Changing your vote is an `update` of `option_id` on your existing row, never a second row.

Length limits (§8): `question` and `label` lengths and the 6-option maximum are enforced by the database check constraints and trigger in migration 082; the 2-option minimum is enforced by `validatePollInput` and `createPoll` atomically.

### Indexes

```sql
create index chat_messages_reply_to on chat_messages(reply_to_id) where reply_to_id is not null;
create index chat_poll_options_poll on chat_poll_options(poll_id, position);
create index chat_poll_votes_poll   on chat_poll_votes(poll_id);
```

---

## 5. Vote privacy — how "staff see names, students see counts" is enforced

This cannot be a UI-level hide. A student hitting PostgREST directly must not be able to read another student's vote.

**Counts and votes are separated into two tables with different read policies.**

- `chat_poll_votes` select policy: `user_id = auth.uid() or (public.is_chat_staff() and public.is_poll_room_member(poll_id))`. A student can read exactly one row — their own — so the UI can highlight their pick. They cannot read anyone else's. The room-membership clause is load-bearing: `is_chat_staff()` is global, so without it any teacher or coach could read every vote in every room, including rooms they have never joined.
- `chat_poll_options.vote_count` holds the tally, maintained by a trigger on vote insert / update / delete. Every room member can read it.
- Staff tapping a result bar issues a second query against `chat_poll_votes`, which their policy permits, and get names.

Adding `chat_poll_options` to the realtime publication (with `replica identity full`) gives **live tallies to everyone** — students included — without a single vote row ever crossing the wire to them.

### `is_chat_staff()` — and why `is_staff()` is the wrong helper here

There is an existing mismatch between the app layer and the database that this feature would otherwise walk straight into:

- `app/chat/[roomId]/page.tsx` treats **`admin`, `coach` and `teacher`** as staff when deciding who may post in a broadcast room.
- `public.is_staff()` (migration `068`) covers only **`admin` and `coach`**. Teachers are not staff by that definition.

Using `is_staff()` for polls would therefore show teachers a Create Poll button that the database silently rejects, and hide voter names from the teachers most likely to need them. This migration adds a helper matching the chat layer's own definition:

```sql
create or replace function public.is_chat_staff()
returns boolean language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid()
      and role in ('admin', 'coach', 'teacher')
      and is_active = true
  )
$$;
```

The `is_active = true` clause follows the precedent set in migration `068`, so a deactivated staff account loses both poll creation and voter-name access automatically.

**Related pre-existing gap, flagged not fixed:** the broadcast read-only rule is enforced only in the UI. Migration `011`'s insert policy is `is_chat_member(room_id) and sender_id = auth.uid()` with no room-kind check, so a student could post to a broadcast room via the API today. Polls do *not* inherit that weakness — creation is checked in the database. Closing the message-side hole is separate work.

### Trigger

```sql
create function public.sync_poll_vote_counts() returns trigger ...
```

Handles all three cases: INSERT increments the chosen option; DELETE decrements; UPDATE decrements `old.option_id` and increments `new.option_id`. Declared `security definer` so a student changing their own vote can move a count they cannot otherwise write.

### RLS summary

"Staff" below always means `is_chat_staff()`, never `is_staff()`.

| Table | select | insert | update | delete |
|---|---|---|---|---|
| `chat_polls` | room member | staff **and** room member | staff **and** room member (any column — see below) | — |
| `chat_poll_options` | room member | staff **and** room member | — (trigger only) | — |
| `chat_poll_votes` | own row, or staff | room member, own `user_id`, poll open | own row, poll open | own row |

The `chat_polls` update policy is column-blind: Postgres RLS gates rows, not columns, so "chat staff close polls" permits room staff to update **any** column on a poll in their room, including `question` — `closePoll` only ever sets `closed_at` because that is all the server action writes, not because the policy forbids the rest. That is accepted: the same people can create the poll in the first place, so editing its wording grants them nothing new. It is written down here so nobody later reads the table as a column-level guarantee.

RLS is enforced even though `createPoll` runs server-side, because the server action uses the *user's* client for these writes rather than the admin client. Using the admin client would bypass the policies and leave the staff-only rule resting on a single `if` statement.

The vote policies key off `public.is_chat_member(room_id)` — deliberately **not** off the broadcast send rule. Otherwise students could not vote in the year-group broadcast rooms, which is the single most likely place to want a poll.

Votes are rejected when `closed_at is not null`, enforced in the policy, not just the UI.

---

## 6. Replies

`reply_to_id` is nullable with `on delete set null`. Two details that are easy to get wrong and both produce a blank or broken quote:

**Parents outside the loaded window.** `page.tsx` loads the last 100 messages. A reply can point to something older. The page therefore collects every `reply_to_id` that is *not* already in that window and fetches those parent rows explicitly (`id, sender_id, body, attachment_kind, deleted_at`), passing them to `ChatThread` as a lookup map. Without this step, replies to older messages render empty.

**Soft-deleted parents.** The parent row still exists but is filtered out of every normal read. A reply whose parent has `deleted_at` set renders a "Message deleted" stub rather than an empty quote.

When a realtime message arrives carrying a `reply_to_id` the client does not hold, the client lazily fetches that one parent. In practice this is rare — you reply to something you can see.

### UI

- **Reply** becomes an entry in the existing `MessageReactionSheet`, above Delete. It is shown for every message, not only your own. This reuses the long-press that already works rather than adding a second gesture.
- A quoted stub sits above the composer while drafting, with an × to cancel.
- Inside the bubble, a tappable quoted strip shows the original sender's name and a one-line excerpt; tapping scrolls to the original and briefly highlights it. If the original is not in the loaded window, the strip is not tappable.

---

## 7. Notifications

`notifyRoomMembers` in `app/chat/actions.ts` is the correct helper to extend — it already sends **both** web push (VAPID) and native push (FCM), which several other push paths in this app still do not. It derives the sender name server-side and verifies the caller belongs to the room.

It gains an optional `replyToUserId` parameter. When present, recipients split into two groups:

- The replied-to user receives `"<Sender> replied to you"`.
- Everyone else receives the existing `"<Sender>"` title.

New polls notify the room through the same helper with the poll question as the preview.

**Correction to the approved design:** during the design discussion this was described as "muted rooms stay muted". That was wrong — `chat_members.muted` exists in the schema but `notifyRoomMembers` does not currently read it, so mute is not honoured for *any* chat push today. Replies and polls inherit that same behaviour. Making mute work is a real gap but a separate piece of work, and is out of scope here.

---

## 8. Input limits

The poll creation form is a question field plus option fields — exactly the shape that has caused a recurring bug in this app: a text input with no `maxLength`, silently truncating at the database boundary with the overflow invisible to the person who typed it.

Every field gets an explicit `maxLength` matching its column limit (question 200, option label 80), with a visible character counter as it fills, following the existing pattern in `components/goals/GoalForm.tsx` and siblings. The server action re-validates length rather than trusting the client.

---

## 9. Server actions vs client inserts

- **Create poll** — a server action (`createPoll`). It writes the poll, its options and the carrier message; a half-succeeded poll with no options is not an acceptable state. It also enforces staff-only and the validation in §8.
- **Close poll** — a server action (`closePoll`). Staff only.
- **Vote** — a direct client upsert under RLS, exactly as reactions already work. Single row, no atomicity concern, and it keeps voting instant.

Any lookup that may legitimately return no row uses `.maybeSingle()`, per the project rule.

---

## 10. Components

| File | Purpose |
|---|---|
| `components/chat/PollCard.tsx` | Renders a poll inside a message bubble: question, option rows with live bars, your choice, total count, Close for staff, and the staff-only voter list |
| `components/chat/CreatePollSheet.tsx` | Bottom sheet for composing a poll, matching the reaction sheet's visual language |
| `components/chat/ReplyQuote.tsx` | The quoted strip, used both above the composer and inside bubbles |
| `components/chat/MessageBubble.tsx` | **Extracted** from `ChatThread.tsx` — see §11 |

## 11. Refactor included in this work

`ChatThread.tsx` is 438 lines and this change adds reply state, poll state, two more realtime subscriptions and a second bottom sheet to it. The message-bubble rendering — currently a ~70-line inline block inside the `messages.map` — moves into `components/chat/MessageBubble.tsx`.

This is scoped deliberately: it is the file being edited, and the extraction is what keeps it reviewable. No other refactoring is proposed.

---

## 12. Testing

| File | Covers |
|---|---|
| `__tests__/chat-reply.test.tsx` | Quoted stub renders from a parent in the window; a soft-deleted parent renders the "Message deleted" stub; a parent outside the window renders from the fetched map; `reply_to_id` is included on insert |
| `__tests__/chat-poll.test.tsx` | Options and counts render; voting replaces a prior vote rather than adding one; a closed poll renders results and disables voting; a student view renders no voter names |
| `__tests__/chat-poll-actions.test.ts` | A student is rejected; a **teacher is accepted** (guards the `is_staff()` / `is_chat_staff()` mismatch in §5); fewer than 2 or more than 6 options rejected; over-length question and labels rejected; `closePoll` is staff-only |

Task review runs `npm run build`, not only `tsc` and `jest` — lint errors have previously passed type-check and unit tests while failing the Vercel build.

---

## 13. Deployment

**This repository has no CI step that applies migrations.** A migration file committed to the repo is not a migration applied to production; this has bitten the project at least twice, with the app quietly misbehaving against a schema that did not match the code.

The implementation plan therefore carries applying `082` to production as its own explicit step, followed by verifying against the live schema that the three tables, the two new `chat_messages` columns, the `is_chat_staff()` helper, the vote-count trigger, and each RLS policy actually exist — not merely that the file was committed.

Realtime publication membership (`chat_poll_options`, `chat_polls`) is part of the same verification: without it, tallies do not update live and the feature looks broken while the tests pass.

---

## 14. Files touched

```
supabase/migrations/082_chat_replies_and_polls.sql   new
app/chat/[roomId]/ChatThread.tsx                     modified
app/chat/[roomId]/page.tsx                           modified
app/chat/actions.ts                                  modified
components/chat/MessageReactionSheet.tsx             modified
components/chat/MessageBubble.tsx                    new (extracted)
components/chat/PollCard.tsx                         new
components/chat/CreatePollSheet.tsx                  new
components/chat/ReplyQuote.tsx                       new
__tests__/chat-reply.test.tsx                        new
__tests__/chat-poll.test.tsx                         new
__tests__/chat-poll-actions.test.ts                  new
```
