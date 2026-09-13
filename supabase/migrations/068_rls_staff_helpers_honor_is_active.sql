-- ============================================================================
-- 068_rls_staff_helpers_honor_is_active.sql
-- Run in Supabase Dashboard → SQL Editor
--
-- 2026-09-13: hardening pass after reconciling every "removed student still
-- shows up somewhere" gap. Audited every RLS policy in the public schema
-- (100+) plus the three security-definer helper functions they rely on
-- (is_staff, is_admin_or_coach, is_chat_member) — none of them ever checked
-- is_active. RLS relies entirely on the paired GoTrue admin ban
-- (053_users_is_active.sql) to actually stop a deactivated account signing
-- in; is_active itself is documented as NOT a login blocker.
--
-- Confirmed live: every currently-deactivated account IS correctly banned,
-- so this is not fixing an active incident — it's closing an unenforced
-- manual invariant (is_active=false always paired with a ban) so it holds
-- even if that second step is ever missed. Without this, a deactivated
-- admin/coach who somehow wasn't also banned would keep full staff-level
-- access to every table gated by is_staff()/is_admin_or_coach() — dozens of
-- tables (safeguarding, bursaries, attendance, chat, etc.).
--
-- Scope: only the two STAFF-privilege functions are hardened here, not
-- every "own row" student policy — a deactivated admin/coach keeping
-- elevated access to OTHER people's data is the consequential risk; a
-- deactivated student still able to read their own historical gym log
-- (also normally blocked by the same ban) is a materially smaller one and
-- is left alone to keep this change's blast radius contained and testable.
--
-- Idempotent: safe to re-run.
-- ============================================================================

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
as $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('admin', 'coach')
    AND is_active = true
  )
$$;

create or replace function public.is_admin_or_coach()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  SELECT EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = ANY (ARRAY['admin','coach']) AND is_active = true
  );
$$;
