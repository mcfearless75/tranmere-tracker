-- ============================================================================
-- 085_schema_drift_remediation.sql
--
-- Closes two of the four findings in docs/schema-drift-audit-2026-09-22.md.
-- The other two were fixed by applying migrations that already existed but had
-- never been run against production (010_lti_platforms, 037_performance_indexes,
-- plus the index statements in 009 and 075).
--
-- Idempotent: safe to re-run, and a no-op against production where both
-- changes have already been applied.
-- ============================================================================

-- ── 1. Record users.shirt_number, which a second application owns ───────────
--
-- The GPS Tag Allocation app (gps-tag-allocation.vercel.app) shares this
-- Supabase project. It added this column to OUR table and writes to it via its
-- own SECURITY DEFINER function `gps_update_shirt_number`. It also writes
-- `catapult_code`, which this repo does own (074_catapult_roster_codes.sql).
--
-- No code in this repo reads or writes shirt_number, and it is added here
-- purely so the column is not invisible to our migrations. Until now a fresh
-- replay produced a `users` table without it, so any future migration that
-- rebuilt or replaced this table would have silently dropped a column a live
-- application depends on — and CI could not have caught it, because the
-- replay runs against an empty database where the column never existed.
--
-- Do not drop this column without checking with whoever runs the GPS app.
alter table public.users add column if not exists shirt_number smallint;

comment on column public.users.shirt_number is
  'Owned and written by the external GPS Tag Allocation app via its '
  'gps_update_shirt_number() SECURITY DEFINER function. Not used by '
  'tranmeretracker. Declared here so migrations cannot drop it by accident — '
  'see docs/schema-drift-audit-2026-09-22.md.';

-- ── 2. Drop an RLS policy that existed only in production ───────────────────
--
-- "admins can update any user" — UPDATE on public.users, both USING and
-- WITH CHECK `is_admin_or_coach()`. It was created directly against production
-- and is in no migration, so it could not be reviewed in git and a rebuilt
-- database would not have had it.
--
-- Verified unnecessary before dropping. It governs direct PostgREST access
-- with a caller's own JWT, and nothing needs that:
--   * every users write in this app goes through the service-role client,
--     which bypasses RLS entirely (userActions.ts, teamActions.ts,
--     profile actions, the admin API routes);
--   * the two user-JWT writes that do exist — ChangePinForm setting
--     must_change_pin, and the profile page upserting a missing own row —
--     touch the caller's OWN row and are covered by "users can update own
--     row";
--   * all seven of the GPS app's gps_* functions are SECURITY DEFINER, so
--     they bypass caller RLS too.
--
-- What it granted that nothing asked for: any coach's own token could PATCH
-- any user row directly against the API. Role escalation was still blocked by
-- prevent_client_role_change (050), but name, year_group, team_id, is_active
-- and contact_email were all writable.
--
-- To revert, if something outside these two apps turns out to have relied on
-- it:
--   create policy "admins can update any user" on public.users
--     for update using (public.is_admin_or_coach())
--     with check (public.is_admin_or_coach());
drop policy if exists "admins can update any user" on public.users;

-- ── Verification (run after applying) ───────────────────────────────────────
-- select count(*) from information_schema.columns
--   where table_schema='public' and table_name='users' and column_name='shirt_number';
--   -- expect 1
-- select count(*) from pg_policies
--   where schemaname='public' and tablename='users'
--     and policyname='admins can update any user';
--   -- expect 0
