-- ============================================================================
-- 056_chat_member_only_visibility.sql
-- Run in Supabase Dashboard → SQL Editor
--
-- Two changes, both requested by the client (Chaid) after the chat_members
-- self-add fix (055) prompted a closer look:
--
-- 1. Staff visibility was blanket: chat_rooms/chat_members/chat_messages
--    SELECT policies OR'd in public.is_staff(), so any admin/coach/teacher
--    could read every group's membership and full message history whether
--    or not they were ever added to it. Chaid wants staff to be able to
--    create, add to, remove from, and manage groups — but only SEE groups
--    they're actually a member of, same as everyone else.
--
--    Safe to remove: the /chat inbox (app/chat/page.tsx) already only ever
--    lists the current user's own chat_members rows, and /chat/[roomId]
--    (app/chat/[roomId]/page.tsx) already rejects non-members at the
--    application level regardless of what the DB would allow. Both use the
--    service-role client anyway, so this change has zero effect on the
--    existing UI — it only closes off a direct-API read (anyone with a
--    staff JWT querying Supabase's REST/Realtime endpoints directly,
--    bypassing the Next.js app) that the app itself never relied on.
--    Realtime message delivery for staff in their OWN rooms is unaffected —
--    is_chat_member() alone already covers that.
--
--    "Staff can add/remove/manage groups" is preserved: "staff manage
--    rooms" (UPDATE) and "staff manage members" (DELETE) still check
--    is_staff() and are untouched by this migration. Every create/add/
--    remove action (app/chat/actions.ts) runs through the service-role
--    admin client anyway, which bypasses RLS entirely regardless of these
--    SELECT policies.
--
-- 2. "Are we allowing students to create groups?" — yes, technically: the
--    chat_rooms INSERT policy was `created_by = auth.uid()` for ANY
--    authenticated user, with no restriction on `kind` (custom/broadcast/
--    squad/match, not just harmless DMs). createGroupChat() already
--    enforces "staff only" at the application level, but that's an
--    app-level check, not a DB one — a direct API call could bypass it
--    entirely. Verified no legitimate feature needs this: createGroupChat,
--    getOrCreateDM, and getOrCreateBotRoom (app/chat/actions.ts) all create
--    rooms via the service-role admin client, which bypasses RLS — so even
--    a student's own DM/bot-room creation never relied on this policy.
--    Restricting INSERT to staff-only closes the gap completely; nothing
--    breaks.
--
-- Idempotent: safe to re-run.
-- ============================================================================

DROP POLICY IF EXISTS "members read rooms" ON chat_rooms;
CREATE POLICY "members read rooms" ON chat_rooms
  FOR SELECT USING (public.is_chat_member(id));

DROP POLICY IF EXISTS "members read members" ON chat_members;
CREATE POLICY "members read members" ON chat_members
  FOR SELECT USING (user_id = auth.uid() OR public.is_chat_member(room_id));

DROP POLICY IF EXISTS "members read messages" ON chat_messages;
CREATE POLICY "members read messages" ON chat_messages
  FOR SELECT USING (public.is_chat_member(room_id));

DROP POLICY IF EXISTS "any user creates room" ON chat_rooms;
CREATE POLICY "any user creates room" ON chat_rooms
  FOR INSERT WITH CHECK (public.is_staff());

-- ── Verification (run after applying) ───────────────────────────────────────
-- As a staff member NOT in a given room (their own JWT, not service role):
--   select * from chat_rooms where id = '<room they are not in>';
--   select * from chat_messages where room_id = '<room they are not in>';
-- Expect: 0 rows, where it previously returned data.
-- As a student (their own JWT):
--   insert into chat_rooms (kind, created_by) values ('custom', auth.uid());
-- Expect: rejected by RLS, where it previously succeeded.
