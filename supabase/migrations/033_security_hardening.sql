-- 033_security_hardening.sql
-- Closes the storage + NFC findings from the June 2026 security audit.
-- APPLIED LIVE 2026-06-10 via MCP apply_migration (name: security_hardening).

-- 1. chat-attachments and coursework buckets were public: anyone with a URL
--    could download students' files. Both go private.
update storage.buckets set public = false where id in ('chat-attachments', 'coursework');

-- 2. Chat attachments upload from the browser, so the bucket needs scoped
--    policies: write only to your own folder, read for signed-in users
--    (signed URLs are minted client-side and honour this SELECT policy).
drop policy if exists "chat_attachments_auth_read" on storage.objects;
create policy "chat_attachments_auth_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'chat-attachments');

drop policy if exists "chat_attachments_own_insert" on storage.objects;
create policy "chat_attachments_own_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'chat-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- coursework bucket is written/read by the service role only — no client
-- policies on purpose: private bucket + no policies = no client access.

-- 3. The NFC check-in token was readable by every signed-in student via
--    settings_read_all USING (true), letting anyone spoof attendance without
--    tapping the sticker. All app reads use the service role, so SELECT can
--    be staff-only.
drop policy if exists "settings_read_all" on academy_settings;
create policy "settings_staff_read" on academy_settings
  for select using (is_staff());
