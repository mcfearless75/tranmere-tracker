-- Run in Supabase SQL Editor — inter-app chat (DMs, squad rooms, broadcasts)

create table if not exists chat_rooms (
  id           uuid primary key default uuid_generate_v4(),
  kind         text not null check (kind in ('dm','squad','broadcast','match','custom')),
  name         text,                                        -- optional label, auto-filled for DMs
  match_id     uuid references match_events(id) on delete cascade,
  created_by   uuid references public.users(id),
  created_at   timestamptz default now(),
  last_message_at timestamptz default now()
);

create index if not exists chat_rooms_last_message on chat_rooms(last_message_at desc);

create table if not exists chat_members (
  room_id      uuid not null references chat_rooms(id) on delete cascade,
  user_id      uuid not null references public.users(id) on delete cascade,
  role         text not null default 'member' check (role in ('owner','admin','member')),
  joined_at    timestamptz default now(),
  last_read_at timestamptz default now(),
  muted        boolean default false,
  primary key (room_id, user_id)
);

create index if not exists chat_members_user on chat_members(user_id);

create table if not exists chat_messages (
  id           uuid primary key default uuid_generate_v4(),
  room_id      uuid not null references chat_rooms(id) on delete cascade,
  sender_id    uuid not null references public.users(id) on delete cascade,
  body         text,
  attachment_url  text,
  attachment_kind text,                                      -- image | file
  created_at   timestamptz default now(),
  deleted_at   timestamptz
);

create index if not exists chat_messages_room on chat_messages(room_id, created_at);

alter table chat_rooms enable row level security;
alter table chat_members enable row level security;
alter table chat_messages enable row level security;

-- Helper: is current user a member of this room?
create or replace function public.is_chat_member(rid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from chat_members where room_id = rid and user_id = auth.uid());
$$;

drop policy if exists "members read rooms" on chat_rooms;
drop policy if exists "staff manage rooms" on chat_rooms;
drop policy if exists "members insert rooms" on chat_rooms;
create policy "members read rooms" on chat_rooms
  for select using (public.is_chat_member(id) or public.is_staff());
create policy "any user creates room" on chat_rooms
  for insert with check (created_by = auth.uid());
create policy "staff manage rooms" on chat_rooms
  for update using (public.is_staff());

drop policy if exists "members read members" on chat_members;
drop policy if exists "staff manage members" on chat_members;
drop policy if exists "self update read receipt" on chat_members;
create policy "members read members" on chat_members
  for select using (user_id = auth.uid() or public.is_chat_member(room_id) or public.is_staff());
create policy "add self or staff adds" on chat_members
  for insert with check (user_id = auth.uid() or public.is_staff());
create policy "self update read receipt" on chat_members
  for update using (user_id = auth.uid());
create policy "staff manage members" on chat_members
  for delete using (public.is_staff());

drop policy if exists "members read messages" on chat_messages;
drop policy if exists "members send messages" on chat_messages;
drop policy if exists "sender or staff delete" on chat_messages;
create policy "members read messages" on chat_messages
  for select using (public.is_chat_member(room_id) or public.is_staff());
create policy "members send messages" on chat_messages
  for insert with check (public.is_chat_member(room_id) and sender_id = auth.uid());
create policy "sender or staff delete" on chat_messages
  for update using (sender_id = auth.uid() or public.is_staff());

-- Auto-bump room's last_message_at when a message is sent
create or replace function public.bump_chat_room()
returns trigger
language plpgsql
as $$
begin
  update chat_rooms set last_message_at = new.created_at where id = new.room_id;
  return new;
end;
$$;

drop trigger if exists chat_messages_bump on chat_messages;
create trigger chat_messages_bump after insert on chat_messages
  for each row execute function public.bump_chat_room();

-- Enable Realtime for live message delivery
do $$
begin
  begin alter publication supabase_realtime add table chat_messages; exception when others then null; end;
  begin alter publication supabase_realtime add table chat_rooms; exception when others then null; end;
end $$;
