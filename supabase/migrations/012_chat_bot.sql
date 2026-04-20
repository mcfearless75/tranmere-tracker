-- 012_chat_bot.sql  — AI Coach bot user + bot room kind + chat attachments bucket

-- 1. Add 'bot' as a valid room kind (safe if already exists)
DO $$
BEGIN
  -- Try adding to enum if it's an enum type
  IF EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'chat_room_kind'
  ) THEN
    ALTER TYPE chat_room_kind ADD VALUE IF NOT EXISTS 'bot';
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- If kind is a plain text/varchar column with a check constraint, drop & recreate constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chat_rooms' AND column_name = 'kind'
    AND data_type IN ('text','character varying')
  ) THEN
    ALTER TABLE chat_rooms DROP CONSTRAINT IF EXISTS chat_rooms_kind_check;
    ALTER TABLE chat_rooms ADD CONSTRAINT chat_rooms_kind_check
      CHECK (kind IN ('dm','squad','match','broadcast','bot'));
  END IF;
END $$;

-- 2. Expand users role check to allow 'bot'
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin','coach','teacher','student','bot'));

-- 3. Insert bot into auth.users first (satisfies users_id_fkey)
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

-- 4. Now insert the bot into the public users table
INSERT INTO users (id, name, role, email)
VALUES ('00000000-0000-0000-0000-000000000099', 'AI Coach', 'bot', 'ai-coach@tranmeretracker.internal')
ON CONFLICT (id) DO UPDATE SET name = 'AI Coach', role = 'bot';

-- 3. Supabase Storage bucket for chat attachments
-- Run this separately in the Supabase dashboard if the bucket doesn't exist:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('chat-attachments', 'chat-attachments', true)
-- ON CONFLICT DO NOTHING;

-- Storage policy: authenticated users can upload to their own folder
-- CREATE POLICY "Users upload own chat attachments" ON storage.objects
--   FOR INSERT TO authenticated WITH CHECK (bucket_id = 'chat-attachments' AND auth.uid()::text = (string_to_array(name, '/'))[1]);
-- CREATE POLICY "Public read chat attachments" ON storage.objects
--   FOR SELECT USING (bucket_id = 'chat-attachments');
