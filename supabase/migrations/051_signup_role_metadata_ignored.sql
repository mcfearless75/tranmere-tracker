-- 051_signup_role_metadata_ignored.sql
-- Run in Supabase Dashboard → SQL Editor
--
-- SECURITY FIX (CRITICAL): handle_new_user() (001_initial_schema.sql), a
-- SECURITY DEFINER trigger fired on every auth.users insert, set the new
-- public.users.role directly from new.raw_user_meta_data->>'role'. That
-- metadata is the `data` object Supabase's public /auth/v1/signup REST
-- endpoint accepts verbatim from ANY caller holding the public anon key
-- (shipped in every page load) — independent of what the app's own /signup
-- form sends. An unauthenticated attacker could POST directly to
-- /auth/v1/signup with {"data":{"role":"admin"}}, bypassing the Next.js app
-- entirely, and be inserted as a full admin.
--
-- No legitimate account-creation path in this app relies on trigger-derived
-- role: self-signup (app/(auth)/signup/actions.ts) only ever sends
-- full_name; app/api/setup/route.ts and app/api/admin/create-user/route.ts
-- both create the auth user with only full_name in user_metadata and then
-- separately UPSERT the correct role via the service-role client, which
-- runs after this trigger and is unaffected by it. So role can be dropped
-- from this trigger entirely with zero legitimate-flow impact.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role)
  VALUES (
    new.id,
    COALESCE(new.email, ''),
    COALESCE(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', split_part(COALESCE(new.email, 'unknown@unknown.com'), '@', 1)),
    'student' -- role is never trusted from client-supplied signup metadata; see 050 for the update-side guard.
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Verification (run separately):
--   Unauthenticated POST to <project>.supabase.co/auth/v1/signup with
--   {"email":"...","password":"...","data":{"role":"admin"}} must result in
--   a public.users row with role = 'student', not 'admin'.
