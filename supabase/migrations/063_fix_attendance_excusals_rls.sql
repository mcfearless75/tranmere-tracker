-- 063_fix_attendance_excusals_rls.sql
-- Run in Supabase Dashboard -> SQL Editor (or via the Supabase MCP apply_migration tool)
--
-- 062's "excusals_staff_all" policy inlined the staff-role subquery instead
-- of using public.is_staff() (SECURITY DEFINER, defined in
-- 008_fix_rls_recursion.sql specifically to avoid this pattern). Every other
-- staff-write policy in this schema uses the helper; this brings
-- attendance_excusals in line and removes the incidental dependency on
-- users' own RLS staying permissive.

drop policy if exists "excusals_staff_all" on attendance_excusals;

create policy "excusals_staff_all"
  on attendance_excusals for all
  using (public.is_staff());

-- Verification (run separately):
--   SELECT policyname, cmd FROM pg_policies WHERE tablename = 'attendance_excusals';
-- Expected: 2 rows — excusals_staff_all (cmd ALL), excusals_self_read (cmd SELECT)
