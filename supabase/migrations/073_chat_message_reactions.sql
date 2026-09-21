create table if not exists chat_message_reactions (
  id          uuid primary key default uuid_generate_v4(),
  message_id  uuid not null references chat_messages(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  emoji       text not null,
  created_at  timestamptz default now(),
  unique (message_id, user_id, emoji)
);

create index if not exists chat_message_reactions_message
  on chat_message_reactions(message_id);

alter table chat_message_reactions enable row level security;

drop policy if exists "members read reactions" on chat_message_reactions;
create policy "members read reactions" on chat_message_reactions
  for select using (
    exists (
      select 1 from chat_messages m
      where m.id = message_id and public.is_chat_member(m.room_id)
    )
  );

drop policy if exists "members add reactions" on chat_message_reactions;
create policy "members add reactions" on chat_message_reactions
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from chat_messages m
      where m.id = message_id and public.is_chat_member(m.room_id)
    )
  );

drop policy if exists "owner remove reactions" on chat_message_reactions;
create policy "owner remove reactions" on chat_message_reactions
  for delete using (user_id = auth.uid());

alter table chat_message_reactions replica identity full;

do $$
begin
  begin alter publication supabase_realtime add table chat_message_reactions;
  exception when others then null;
  end;
end $$;
