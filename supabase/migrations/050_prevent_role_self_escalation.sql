-- 050_prevent_role_self_escalation.sql
-- Run in Supabase Dashboard → SQL Editor
--
-- SECURITY FIX (CRITICAL): the "users can update own row" RLS policy
-- (005_users_self_update.sql, reaffirmed in 008_fix_rls_recursion.sql) is
-- row-scoped only (`using (auth.uid() = id) with check (auth.uid() = id)`) —
-- it never restricted which COLUMNS a user may change on their own row. Every
-- authorization check in the app (middleware.ts, lib/auth/requireRole.ts,
-- and therefore the admin-only guards on /api/admin/create-user and
-- /api/admin/reset-pin) trusts public.users.role as ground truth. So any
-- authenticated user — including a student signed in with the shared default
-- PIN — could run, from the browser's own already-loaded Supabase client:
--   supabase.from('users').update({ role: 'admin' }).eq('id', myUserId)
-- and the RLS policy would allow it, self-promoting to admin.
--
-- The self-update policy legitimately needs to stay row-scoped and broad
-- (profile fields, must_change_pin, etc. — see components/account/ChangePinForm.tsx
-- and the account-settings flow), so rather than enumerate every column a
-- future feature might legitimately self-update, this locks down the one
-- column that is an authorization boundary: role can only change when the
-- request is made by the service-role client (which every legitimate role
-- assignment in this app already uses — see app/api/setup/route.ts and
-- app/api/admin/create-user/route.ts, both of which UPSERT via the admin
-- client, never via the user's own session).

CREATE OR REPLACE FUNCTION public.prevent_client_role_change()
RETURNS trigger AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    -- auth.role() reads the caller's JWT role claim (same helper already
    -- used in 019_ai_player_reports.sql). It is 'service_role' only for
    -- requests made with SUPABASE_SERVICE_ROLE_KEY — never for a normal
    -- authenticated user's own session, so this cannot be spoofed from the
    -- client.
    IF auth.role() IS DISTINCT FROM 'service_role' THEN
      RAISE EXCEPTION 'role cannot be changed via this update path';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS prevent_client_role_change_trigger ON public.users;
CREATE TRIGGER prevent_client_role_change_trigger
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.prevent_client_role_change();

-- Verification (run separately):
--   1. As a non-admin authenticated user (browser console, anon-key client):
--        supabase.from('users').update({ role: 'admin' }).eq('id', <own id>)
--      must now return an error, and the row's role must be unchanged.
--   2. Existing admin-only role changes (via /api/admin/create-user,
--      /api/admin/reset-pin, /api/setup) must continue to work — they all
--      write through the service-role client.
