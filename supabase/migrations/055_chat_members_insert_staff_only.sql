-- ============================================================================
-- 055_chat_members_insert_staff_only.sql
-- Run in Supabase Dashboard → SQL Editor
--
-- Closes the chat_members self-add gap flagged in the 2026-09-04 security
-- review: the INSERT policy allowed `user_id = auth.uid()` for any
-- non-synced (custom/DM/bot) room, with no check that the caller was ever
-- actually invited. Anyone — including a student — who learned a room's
-- UUID (an old push-notification deep link, a previous membership before
-- being removed, etc.) could silently re-add themselves via a direct
-- client-side insert, then read the room's full message history via
-- is_chat_member().
--
-- Verified safe to tighten: every legitimate write to chat_members already
-- goes through a server action using the service-role admin client
-- (createGroupChat, addGroupMembers, getOrCreateDM, getOrCreateBotRoom,
-- app/api/admin/broadcast — see app/chat/actions.ts), which bypasses RLS
-- entirely. No code path in the app relies on a direct client-side insert
-- against chat_members, so removing the self-insert branch breaks nothing.
--
-- Idempotent: safe to re-run.
-- ============================================================================

DROP POLICY IF EXISTS "add self or staff adds" ON chat_members;
CREATE POLICY "add self or staff adds" ON chat_members
  FOR INSERT WITH CHECK (public.is_staff());

-- ── Verification (run after applying) ───────────────────────────────────────
-- As a student (their own JWT, not service role):
--   insert into chat_members (room_id, user_id) values ('<some other room id>', auth.uid());
-- Expect: rejected by RLS (0 rows / permission error), where it previously succeeded.
