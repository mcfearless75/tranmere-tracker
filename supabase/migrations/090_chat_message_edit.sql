-- Chat message editing, plus a column guard on chat_messages UPDATE.
--
-- The existing UPDATE policy ("sender or staff delete") has a USING clause
-- and no WITH CHECK, and RLS cannot restrict columns. So until now the
-- sender, AND any staff member, could rewrite every column of a message —
-- including someone else's body, sender_id or room_id — straight through
-- PostgREST. The app only ever sets deleted_at, but the database allowed
-- far more. This trigger narrows it to what the app actually needs:
--   * anyone the policy already admits may soft-delete (set deleted_at)
--   * only the sender may change body, within 15 minutes, on a live,
--     non-poll message; edited_at is stamped by the database, not the client
--   * nothing else changes, and nothing is ever un-deleted
-- Service-role writes (auth.uid() is null) are left alone for backend jobs.

alter table public.chat_messages add column if not exists edited_at timestamptz;

create or replace function public.guard_chat_message_update()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if new.room_id         is distinct from old.room_id
  or new.sender_id       is distinct from old.sender_id
  or new.created_at      is distinct from old.created_at
  or new.attachment_url  is distinct from old.attachment_url
  or new.attachment_kind is distinct from old.attachment_kind
  or new.reply_to_id     is distinct from old.reply_to_id
  or new.poll_id         is distinct from old.poll_id then
    raise exception 'Only the message text can be edited';
  end if;

  if old.deleted_at is not null and new.deleted_at is distinct from old.deleted_at then
    raise exception 'This message was deleted';
  end if;

  if new.body is distinct from old.body then
    if old.sender_id <> auth.uid() then
      raise exception 'You can only edit your own messages';
    end if;
    if old.deleted_at is not null or old.poll_id is not null then
      raise exception 'This message cannot be edited';
    end if;
    if old.created_at < now() - interval '15 minutes' then
      raise exception 'Messages can only be edited for 15 minutes after sending';
    end if;
    if new.body is null or btrim(new.body) = '' then
      raise exception 'An edited message cannot be empty';
    end if;
    new.edited_at := now();
  else
    new.edited_at := old.edited_at;
  end if;

  return new;
end;
$$;

drop trigger if exists chat_messages_guard_update on public.chat_messages;
create trigger chat_messages_guard_update
  before update on public.chat_messages
  for each row execute function public.guard_chat_message_update();
