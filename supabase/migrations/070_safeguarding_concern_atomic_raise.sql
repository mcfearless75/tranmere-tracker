-- ============================================================================
-- 070_safeguarding_concern_atomic_raise.sql
-- Run in Supabase Dashboard → SQL Editor (or via the Supabase MCP apply_migration tool)
--
-- attendance-safeguarding-check's per-student dedup (upfront SELECT, then
-- INSERT and check the error) was generating ~490 duplicate-key Postgres
-- errors/day in production — confirmed via the Supabase log explorer,
-- 2026-09-15: exactly 26 duplicate-key hits on
-- safeguarding_concerns_one_auto_per_day every 15-minute tick from 15:00
-- through 19:45, for the same already-cased students. Behaviour was never
-- wrong (the insert's error check already prevented a duplicate case or a
-- double notification), just a wasted extra round trip every tick, noisy
-- enough in the log stream to bury genuine failures.
--
-- safeguarding_concerns_one_auto_per_day (migration 060) is a PARTIAL unique
-- index (WHERE raised_by IS NULL), so PostgREST's upsert — which only ever
-- emits `ON CONFLICT (columns)` with no WHERE clause — can't target it
-- directly ("no unique or exclusion constraint matching the ON CONFLICT
-- specification", confirmed live against this exact index). A small SQL
-- function that runs the same INSERT ... ON CONFLICT (...) WHERE
-- raised_by IS NULL DO NOTHING server-side sidesteps that PostgREST
-- limitation entirely: one round trip, no error at any layer on the common
-- (already-raised) case.
--
-- Idempotent: CREATE OR REPLACE, safe to re-run.
-- ============================================================================

create or replace function public.raise_attendance_safeguarding_concern(
  p_student_id uuid,
  p_raised_date date,
  p_description text
)
returns table(id uuid)
language sql
as $$
  insert into public.safeguarding_concerns
    (student_id, raised_by, category, raised_date, severity, description, status)
  values
    (p_student_id, null, 'attendance', p_raised_date, 'high', p_description, 'open')
  on conflict (student_id, category, raised_date) where raised_by is null do nothing
  returning safeguarding_concerns.id;
$$;

-- Server-side cron use only (service-role client) — never callable from a
-- student/staff session, same restriction pattern as the chat schema's
-- is_synced_room()/is_chat_member() helpers.
revoke all on function public.raise_attendance_safeguarding_concern(uuid, date, text) from public;
grant execute on function public.raise_attendance_safeguarding_concern(uuid, date, text) to service_role;

-- ── Verification (run after applying) ───────────────────────────────────────
-- select * from public.raise_attendance_safeguarding_concern(
--   (select id from public.users where role = 'student' limit 1),
--   current_date, 'test'
-- );
-- -- First call: 1 row with a new id. Run the exact same call again:
-- -- 0 rows, no error either time. Clean up the test row afterwards:
-- -- delete from safeguarding_concerns where description = 'test';
-- ============================================================================
