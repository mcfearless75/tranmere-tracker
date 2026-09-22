-- ============================================================================
-- 086_rls_policies_use_hardened_helpers.sql
--
-- Finishes the job 068_rls_staff_helpers_honor_is_active.sql started, and
-- fixes four policies where the repo and production had drifted apart in
-- BOTH directions. Found by the schema drift audit
-- (docs/schema-drift-audit-2026-09-22.md) while verifying the remediation.
--
-- 068 hardened the two staff helper functions — is_staff() and
-- is_admin_or_coach() — to require is_active, so a deactivated admin or coach
-- loses staff-level access even if the paired GoTrue ban was ever missed.
--
-- What it did not do is notice that four policies never call those helpers.
-- Three of them still inline `EXISTS (select 1 from users where id = auth.uid()
-- and role in ('admin','coach'))`, which reimplements the check WITHOUT the
-- is_active condition — so 068's hardening simply does not apply to them.
--
-- Production had already been corrected for those three by hand, so prod was
-- SAFER than the repo: rebuilding from migrations (a preview branch, a restore,
-- a new environment) would have silently reintroduced the gap.
--
-- The fourth drifted the other way. `match_squads` "players see own squad
-- entries" was rewritten to use is_staff() by 008_fix_rls_recursion.sql, but
-- production still has the older inline version — so production currently
-- lets a deactivated coach read match_squads rows.
--
--   policy                                        repo        production
--   attendance_records "staff see all …"          inline      is_staff()
--   attendance_sessions "staff manage …"          inline      is_staff()
--   users "users_select_admin"                    inline      is_admin_or_coach()
--   match_squads "players see own squad entries"  is_staff()  inline
--
-- This migration settles all four on the helper, which is the hardened form in
-- every case, so repo and production agree and 068's guarantee actually holds.
--
-- Idempotent: drop-then-create, safe to re-run.
-- ============================================================================

-- ── attendance_records ──────────────────────────────────────────────────────
drop policy if exists "staff see all attendance_records" on public.attendance_records;
create policy "staff see all attendance_records"
  on public.attendance_records for all
  using (public.is_staff());

-- ── attendance_sessions ─────────────────────────────────────────────────────
drop policy if exists "staff manage attendance_sessions" on public.attendance_sessions;
create policy "staff manage attendance_sessions"
  on public.attendance_sessions for all
  using (public.is_staff());

-- ── users ───────────────────────────────────────────────────────────────────
-- Note this is one of several SELECT policies on users; they are permissive,
-- so "users can read own row" / "users_select_own" still cover a student
-- reading their own record.
drop policy if exists "users_select_admin" on public.users;
create policy "users_select_admin"
  on public.users for select
  using (public.is_admin_or_coach());

-- ── match_squads ────────────────────────────────────────────────────────────
-- The direction production was stale in: restores 008_fix_rls_recursion.sql's
-- intent, so a deactivated coach can no longer read squad rows.
drop policy if exists "players see own squad entries" on public.match_squads;
create policy "players see own squad entries"
  on public.match_squads for select
  using (player_id = auth.uid() or public.is_staff());

-- ── Verification (run after applying) ───────────────────────────────────────
-- select tablename, policyname, qual from pg_policies
-- where schemaname='public'
--   and policyname in ('staff see all attendance_records',
--                      'staff manage attendance_sessions',
--                      'users_select_admin',
--                      'players see own squad entries');
-- Expect every `qual` to reference is_staff() or is_admin_or_coach(),
-- and none to contain an inline `EXISTS ... role = ANY`.
