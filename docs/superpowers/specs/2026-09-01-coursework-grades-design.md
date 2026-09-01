# Coursework Grades — Design

**Date:** 2026-09-01
**Status:** Approved, ready for implementation plan

## Problem

`assignments` (title, description, due_date, grade_target, unit_id →
`btec_units`) already tracks coursework deadlines and shows them on the
calendar as "deadline" events. But there is no admin UI to manage
assignments at all — the table is only ever populated by `seed-demo` fake
data — and, more importantly, nothing records what a student actually
achieved. `grade_target` is an aspiration set once for everyone on the
unit; there is no per-student outcome anywhere in the schema.

Students and parents should be able to see real BTEC results (Pass /
Merit / Distinction / Not yet achieved) per assignment, not just the
deadline and the target.

## Architecture

Same shape as the timetable feature: a staff-managed admin page, thin
service-role API routes, and two read-only student/parent views. One new
table (`assignment_grades`) records the per-student outcome; `assignments`
and `btec_units` are unchanged.

- **`/admin/coursework`** (new) — staff manage assignments (create/edit/
  delete, scoped to a unit) and enter grades via a bulk grade sheet.
- **`/coursework`** (new, student) — a student's own assignments grouped
  by unit, each showing due date, target grade, and achieved grade (or
  "Awaiting result").
- **`/parent/coursework`** (new) — same view, read-only, for a parent's
  linked student(s).
- **Calendar integration** — the existing "deadline" event label appends
  the achieved grade once one exists, in `getCalendarEvents()`.

## Data model

New migration `047_assignment_grades.sql`:

```sql
create table assignment_grades (
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
```

`grade` is nullable — no row, or a null `grade`, both mean "not yet
marked." The `unique (assignment_id, student_id)` constraint is what makes
the bulk grade-sheet save an upsert: re-saving the same sheet never
creates duplicate rows.

`assignments` and `btec_units` need no schema changes — `assignments`
already has everything the admin CRUD form needs, and enrollment is
already resolvable via the existing `users.course_id` →
`btec_units.course_id` link.

## Backend routes

Following the exact pattern of `/api/admin/timetable-slots`:

- `POST /api/admin/assignments` — create. Staff-only (`requireStaff()`).
  Validates `title`, `due_date`, `unit_id` (must reference a real
  `btec_units` row).
- `PATCH /api/admin/assignments/[assignmentId]` — edit.
- `DELETE /api/admin/assignments/[assignmentId]` — delete (cascades to
  `assignment_grades` via `on delete cascade`).
- `POST /api/admin/assignments/[assignmentId]/grades` — bulk upsert.
  Body: `{ grades: [{ student_id, grade }] }`. Staff-only. Validates every
  row before writing any of them: each `grade` must be one of the 4
  allowed values (or `null`), each `student_id` must belong to a student
  whose `course_id` matches the assignment's unit's course. Upserts via
  `on conflict (assignment_id, student_id) do update`.

All four use `requireStaff()` + `createAdminClient()`, identical to the
timetable and calendar-events routes — no new auth pattern.

## Frontend / UI

- **`lib/coursework/courseworkUtils.ts`** (new) — pure helpers, no
  Supabase involved, following `timetableUtils.ts`'s discipline:
  - `groupAssignmentsByUnit(assignments, units)` — for the student/parent
    view.
  - `GRADE_LABELS` / `GRADE_COLOURS` — display mapping for the 4 grade
    values plus the ungraded state.
- **`app/(admin)/admin/coursework/`** (new) — course selector (the 3 BTEC
  pathways) at the top; units for that course below, each listing its
  assignments with an add/edit/delete form (mirrors
  `TimetableManager.tsx`); each assignment has a "Grade" button opening
  the bulk grade sheet (every student on that course, one row each, a
  grade `<select>`, one "Save all" button posting the whole sheet).
- **`app/(student)/coursework/page.tsx`** (new) — assignments grouped by
  unit via `groupAssignmentsByUnit`, achieved grade as a coloured badge
  (or "Awaiting result"). Nav link ("Coursework") shown whenever
  `profile.course_id` is set — **not** year-group-gated, since a course
  spans both year groups, unlike Timetable.
- **`app/(parent)/parent/coursework/page.tsx`** (new) — same layout,
  read-only, scoped via `parent_student_links` exactly like
  `/parent/calendar` already is.
- **`lib/calendar/calendarUtils.ts`**: `getCalendarEvents()`'s existing
  deadline-label logic appends `" — {grade label}"` once a grade exists
  for that student's assignment; unchanged otherwise.
- Nav: add "Coursework" to `SideNav`/`BottomNav` (student) and
  `ParentSidebar`/`MobileParentBar` (parent), same `showX` boolean-prop
  pattern already used for `showTimetable`.

## Error handling & edge cases

- **Ungraded assignment**: no row (or a null `grade`) in
  `assignment_grades` → renders "Awaiting result" everywhere, never a
  crash. `.maybeSingle()` / array-filter patterns throughout, per the
  project's Supabase rule.
- **Student changes course**: existing grades stay tied to the assignment
  they were given for; they simply stop appearing on the student's
  *current* coursework list once `course_id` no longer matches. No
  retroactive deletion.
- **Assignment deleted while grades exist**: `on delete cascade` on
  `assignment_grades.assignment_id` cleans up its grades — no orphans.
- **Bulk-save partial failure**: the grades POST validates every row
  before writing any of them — no half-saved grade sheets.
- **Non-staff hitting admin routes**: `requireStaff()` guard, identical to
  every other admin route in the app.

## Testing

- `lib/coursework/courseworkUtils.ts` — pure-function unit tests
  (grouping, grade-label mapping), no Supabase involved.
- `/api/admin/assignments` (POST/PATCH/DELETE) — staff-only,
  required-field validation, mirrors `timetableSlotsRoute.test.ts`.
- `/api/admin/assignments/[id]/grades` — staff-only, rejects an invalid
  grade value, rejects a student not on that course, upserts correctly on
  a repeat save.
- `getCalendarEvents()` grade-label enhancement — extend the existing
  `calendarUtils.test.ts` rather than a new file.

## Out of scope (deliberately)

- No file upload / submission tracking — outcome-only (grade), matching
  that nothing else in the app handles student file submissions.
- No push notification when a grade is entered — checked in-app, same as
  calendar events today. Can be added later the same way the timetable
  reminder cron was, once this ships and is in real use.
- No admin-side gradebook analytics (pass rates, cohort trends) — that
  was the "admin oversight" option not chosen for this pass; the existing
  AI cohort-report already has some of this via `btec_units` context.
- No change to `assignments.grade_target` semantics — it stays the
  aspirational target set once per unit; `assignment_grades.grade` is the
  new, separate, per-student achieved outcome.
