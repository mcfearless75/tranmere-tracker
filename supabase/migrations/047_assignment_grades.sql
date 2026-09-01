-- 047_assignment_grades.sql
-- Run in Supabase Dashboard → SQL Editor (or via the Supabase MCP apply_migration tool)
--
-- Per-student BTEC outcome against an existing `assignments` deadline.
-- `assignments.grade_target` stays the aspirational target set once per
-- unit; this table is the separate, per-student, actually-achieved result.

create table if not exists assignment_grades (
  id            uuid primary key default uuid_generate_v4(),
  assignment_id uuid not null references assignments(id) on delete cascade,
  student_id    uuid not null references public.users(id) on delete cascade,
  grade         text check (grade in ('pass', 'merit', 'distinction', 'not_yet_achieved')),
  graded_by     uuid references public.users(id),
  graded_at     timestamptz,
  updated_at    timestamptz default now(),
  unique (assignment_id, student_id)
);

alter table assignment_grades enable row level security;

-- Staff manage (all commands) — matches timetable_slots' pattern
create policy "staff can manage assignment_grades"
  on assignment_grades for all
  using (public.is_staff());

-- Students can only read their own grades
create policy "students read own assignment_grades"
  on assignment_grades for select
  to authenticated
  using (student_id = auth.uid());

-- Parents can read their linked student(s)' grades
create policy "parents read linked student assignment_grades"
  on assignment_grades for select
  to authenticated
  using (
    exists (
      select 1 from public.parent_student_links
      where parent_student_links.parent_id = auth.uid()
        and parent_student_links.student_id = assignment_grades.student_id
    )
  );
