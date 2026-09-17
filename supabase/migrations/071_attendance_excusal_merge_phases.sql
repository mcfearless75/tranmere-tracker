-- ============================================================================
-- 071_attendance_excusal_merge_phases.sql
-- Run in Supabase Dashboard → SQL Editor (or via the Supabase MCP apply_migration tool)
--
-- Final-review Finding 1 (Critical): the 'excuse' action's plain
-- `.upsert(row, { onConflict: 'student_id,excused_date' })` REPLACED the
-- whole attendance_excusals row wholesale. MissingRowActions
-- (components/attendance/MissingRowActions.tsx) is the only caller that
-- sends a partial `phases` array (e.g. ['lunch']) — excusing AM then lunch
-- for the same student/date silently dropped AM back to missing, and the
-- same overwrite could destroy a whole-day ExcuseButton excusal's
-- reason/note/phase coverage. attendance_excusals is read by
-- missed-checkin-sweep, attendance-safeguarding-check (to suppress false
-- alerts) and the weekly attendance report (to exclude authorised absence)
-- — a silently-dropped excusal is a false safeguarding nudge and a wrong
-- attendance % on the college-facing PDF.
--
-- This function does the read-merge-write as ONE atomic INSERT ... ON
-- CONFLICT ... DO UPDATE statement — no separate SELECT-then-write JS round
-- trip that could race (the same bug class already hit twice in this
-- codebase: migrations 052 and 060).
--
-- Merge precedence (deliberate choice — see final-fix-report.md for the
-- full writeup):
--   - phases: always UNIONED with whatever phases already exist for that
--     student/date — a call never narrows coverage, only widens it.
--   - reason/note: on a genuine INSERT (no existing row for that
--     student/date), the caller's reason/note are stored as normal. On a
--     CONFLICT (a row already exists), reason/note are deliberately NOT
--     listed in the SET clause below, so Postgres keeps the row's
--     ORIGINAL values. MissingRowActions always sends a generic
--     reason: 'other' for its one-tap per-phase action — without this, a
--     second quick "Excuse lunch" tap on a day already excused all-day for
--     'ill' with a real note would silently blow that note away. If staff
--     need to correct a wrong reason/note on an already-excused day, they
--     clear it first (action: 'clear') and re-excuse from scratch — there
--     is intentionally no "force overwrite" path here.
--
-- Idempotent: CREATE OR REPLACE, safe to re-run.
-- ============================================================================

create or replace function public.upsert_attendance_excusal_merge_phases(
  p_student_id uuid,
  p_excused_date date,
  p_reason text,
  p_note text,
  p_phases text[],
  p_created_by uuid
)
returns table(phases text[], reason text, note text)
language sql
as $$
  insert into public.attendance_excusals
    (student_id, excused_date, reason, note, phases, created_by)
  values
    (p_student_id, p_excused_date, p_reason, p_note, p_phases, p_created_by)
  on conflict (student_id, excused_date) do update
    set phases = (
      select array_agg(distinct p)
      from unnest(attendance_excusals.phases || excluded.phases) as p
    )
  returning attendance_excusals.phases, attendance_excusals.reason, attendance_excusals.note;
$$;

-- Server-side use only (service-role client, called from the already
-- staff-role-checked app/api/attendance/excuse route) — same restriction
-- pattern as raise_attendance_safeguarding_concern() (migration 070).
revoke all on function public.upsert_attendance_excusal_merge_phases(uuid, date, text, text, text[], uuid) from public;
grant execute on function public.upsert_attendance_excusal_merge_phases(uuid, date, text, text, text[], uuid) to service_role;

-- ── Verification (run after applying) ───────────────────────────────────────
-- -- 1. Fresh row (no prior excusal that day):
-- select * from public.upsert_attendance_excusal_merge_phases(
--   (select id from public.users where role = 'student' limit 1),
--   current_date, 'ill', 'test note', array['am'],
--   (select id from public.users where role in ('admin','coach','teacher') limit 1)
-- );
-- -- -> phases = {am}, reason = ill, note = 'test note'
--
-- -- 2. Same student/date, a different phase AND a different reason —
-- --    phases UNION to {am,lunch}; reason/note stay from step 1 (NOT
-- --    overwritten by 'other'/null from this second call):
-- select * from public.upsert_attendance_excusal_merge_phases(
--   (select id from public.users where role = 'student' limit 1),
--   current_date, 'other', null, array['lunch'],
--   (select id from public.users where role in ('admin','coach','teacher') limit 1)
-- );
-- -- -> phases = {am,lunch}, reason = ill (unchanged), note = 'test note' (unchanged)
--
-- -- Clean up the test row afterwards:
-- -- delete from attendance_excusals where excused_date = current_date and note = 'test note';
-- ============================================================================
