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
  unique (poll_id, position),
  unique (id, poll_id)
);

-- unique (poll_id, user_id) is what makes this single-choice: changing your
-- vote is an UPDATE of option_id on your existing row, never a second row.
create table if not exists chat_poll_votes (
  id         uuid primary key default uuid_generate_v4(),
  poll_id    uuid not null references chat_polls(id) on delete cascade,
  option_id  uuid not null,
  user_id    uuid not null references public.users(id) on delete cascade,
  created_at timestamptz default now(),
  unique (poll_id, user_id),
  foreign key (option_id, poll_id) references chat_poll_options(id, poll_id) on delete cascade
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

-- ── 4b. Max-options trigger ─────────────────────────────────────────────
-- Enforces the 2-6 option limit (maximum only). Must stay in step with
-- POLL_MAX_OPTIONS in lib/chat/types.ts. A per-row before insert trigger
-- that counts existing + already-inserted rows within the statement ensures
-- that even a multi-row insert (createPoll's atomic insert of all options)
-- is correctly rejected if it would exceed 6 total options for the poll.
create or replace function public.validate_poll_option_count()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from chat_poll_options where poll_id = new.poll_id) >= 6 then
    raise exception 'Poll cannot have more than 6 options';
  end if;
  return new;
end;
$$;

drop trigger if exists chat_poll_options_max on chat_poll_options;
create trigger chat_poll_options_max
  before insert on chat_poll_options
  for each row execute function public.validate_poll_option_count();

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
