-- 062_attendance_excusals.sql
-- Run in Supabase Dashboard -> SQL Editor (or via the Supabase MCP apply_migration tool)
--
-- Staff-recorded reason a student isn't expected in (parent called/emailed:
-- ill or at an appointment). Kept separate from daily_attendance so "did they
-- physically check in" (evidence: GPS, selfie, NFC tap) stays distinct from
-- "why weren't they expected in" (a staff-entered reason with no evidence).
-- One row per student per day; phases[] defaults to the whole day but can be
-- narrowed (e.g. a morning appointment, back for lunch/PM). Consumed by:
--   - the Daily Attendance page (app/(admin)/admin/attendance/page.tsx)
--   - missed-checkin-sweep and attendance-safeguarding-check (alert suppression)
--   - the weekly attendance report (excluded from the % denominator)
-- See docs/superpowers/specs/2026-09-08-attendance-excusals-design.md

create table if not exists attendance_excusals (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references public.users(id) on delete cascade,
  excused_date  date not null,
  reason        text not null check (reason in ('ill', 'appointment', 'other')),
  note          text,
  phases        text[] not null default array['am','lunch','pm'],
  created_by    uuid not null references public.users(id),
  created_at    timestamptz default now(),
  unique(student_id, excused_date)
);

create index if not exists idx_attendance_excusals_date on attendance_excusals(excused_date);

alter table attendance_excusals enable row level security;

-- Uses public.is_staff() (SECURITY DEFINER, defined in 008_fix_rls_recursion.sql)
-- rather than inlining the role subquery, matching every other staff-write
-- policy in this schema. NOTE: this table was originally created with an
-- inlined subquery here; the live database (avpdwutgtsurddvfxhmh) was
-- corrected via 063_fix_attendance_excusals_rls.sql — this file is updated
-- in place so a fresh database build ends up consistent too.
create policy "excusals_staff_all"
  on attendance_excusals for all
  using (public.is_staff());

create policy "excusals_self_read"
  on attendance_excusals for select
  using (auth.uid() = student_id);

-- Verification (run separately):
--
-- 1. Table + RLS enabled (should return 1 row, rowsecurity = true):
--   SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'attendance_excusals';
--
-- 2. Both policies exist (should return 2 rows):
--   SELECT policyname, cmd FROM pg_policies WHERE tablename = 'attendance_excusals';
