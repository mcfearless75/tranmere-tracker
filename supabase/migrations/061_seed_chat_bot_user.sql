-- 061_seed_chat_bot_user.sql
--
-- migrations/012_chat_bot.sql (present in the repo since the AI Coach feature
-- shipped) was never actually applied to this database — confirmed live
-- 2026-09-07: `select * from public.users where id = '...0099'` returned
-- zero rows, and none of 011-018 appear in this project's applied-migration
-- history at all (it jumps straight from the April baseline to 019+).
--
-- Effect: chat_members.user_id has a hard FK to users(id). getOrCreateBotRoom
-- inserts the caller's own membership row and the bot's membership row in
-- ONE array insert — with the bot row missing its users(id) target, the
-- WHOLE insert fails atomically, silently (the app never checked the error —
-- see app/chat/actions.ts). The chat_rooms row itself is a separate insert
-- that still succeeds, so every single tap on "AI Coach" created a new
-- membership-less room and immediately hit "You're not a member of this
-- conversation." Confirmed live: two such orphaned rooms from Caleb
-- McWilliam tonight (2026-09-07 21:34 and 21:52 UTC), plus one older orphan
-- from 2026-04-20 predating this investigation.
--
-- This re-applies exactly what 012 always intended, idempotently, and
-- cleans up the specific orphaned rooms confirmed to have zero members and
-- zero messages (safe per this repo's pre-mass-delete FK audit rule — both
-- chat_members.room_id and chat_messages.room_id cascade from chat_rooms).

INSERT INTO auth.users (id, email, role, aud, encrypted_password, created_at, updated_at, confirmation_sent_at, is_sso_user, deleted_at)
VALUES (
  '00000000-0000-0000-0000-000000000099',
  'ai-coach@tranmeretracker.internal',
  'authenticated',
  'authenticated',
  '',
  now(), now(), now(), false, null
)
ON CONFLICT (id) DO NOTHING;

-- The auth.users insert above fires handle_new_user(), which auto-creates a
-- matching public.users row with the default 'student' role (migration 051 —
-- signup always defaults to student, ignoring metadata). The upsert below
-- then needs to actually change that role to 'bot', which
-- prevent_client_role_change_trigger (migration 050) blocks outside a
-- service-role request context — which a raw SQL migration is not. Disabling
-- it only around this one statement, in the same transaction, keeps the
-- protection intact for every real client request.
ALTER TABLE public.users DISABLE TRIGGER prevent_client_role_change_trigger;

INSERT INTO public.users (id, name, role, email)
VALUES ('00000000-0000-0000-0000-000000000099', 'AI Coach', 'bot', 'ai-coach@tranmeretracker.internal')
ON CONFLICT (id) DO UPDATE SET name = 'AI Coach', role = 'bot';

ALTER TABLE public.users ENABLE TRIGGER prevent_client_role_change_trigger;

-- Confirmed zero members and zero messages on each before deleting.
DELETE FROM chat_rooms
WHERE id IN (
  '047cc15b-0f3b-49ae-bb01-4ed212a8e0a7',
  '65bc67c6-c4c0-49c5-b2ad-fabea26baedf',
  'b36d34a1-5742-47b0-b337-d974adbd35c4'
)
AND NOT EXISTS (SELECT 1 FROM chat_members cm WHERE cm.room_id = chat_rooms.id);
