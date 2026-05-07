-- Native push tokens (FCM for Android, APNs for iOS)
-- Separate from web push_subscriptions which store VAPID endpoint/keys.

CREATE TABLE IF NOT EXISTS public.native_push_tokens (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token       text        NOT NULL,
  platform    text        NOT NULL CHECK (platform IN ('ios', 'android')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_native_token UNIQUE (user_id, token)
);

-- Index for lookups by user (sending notifications to all devices for a user)
CREATE INDEX IF NOT EXISTS idx_native_push_tokens_user_id
  ON public.native_push_tokens (user_id);

-- RLS: users can read/delete their own tokens; only service role can insert/update
ALTER TABLE public.native_push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own native tokens"
  ON public.native_push_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own native tokens"
  ON public.native_push_tokens FOR DELETE
  USING (auth.uid() = user_id);

-- Service role (admin client) handles INSERT/UPDATE — no user-facing policy needed
-- because the API route uses createAdminClient() which bypasses RLS.
