# Coursework Grades Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let staff record per-student BTEC outcomes (Pass/Merit/Distinction/Not yet achieved) against existing coursework deadlines, and let students/parents see them.

**Architecture:** One new table (`assignment_grades`) joins the existing `assignments`/`btec_units` catalogue to a student. A new admin page manages assignments (CRUD, mirroring the Timetable manager) and a bulk grade sheet per assignment. Two new read-only pages (student `/coursework`, parent `/parent/coursework`) display grouped results. The existing calendar deadline label gets the achieved grade appended.

**Tech Stack:** Next.js 14 App Router, Supabase (Postgres + RLS), TypeScript strict, Jest + Testing Library, Tailwind.

**Spec:** `docs/superpowers/specs/2026-09-01-coursework-grades-design.md`

## Global Constraints

- Use `.maybeSingle()` for any Supabase lookup that may legitimately return no row — never `.single()` for an optional row.
- TypeScript strict — no `any` types without justification; define a local row type instead.
- Every new API route uses `requireStaff()` from `lib/auth/requireRole.ts` — the service-role client bypasses RLS, so the app-layer role check is the real gate.
- All new features need Jest tests in `__tests__/`, following the existing convention: pure `lib/` functions and presentational `components/` get tests; CRUD manager forms and page-level server components are verified by hand (tsc + build), matching `TimetableManager`/`CalendarEventsManager`/`timetableUtils.test.ts` precedent.
- Components go in `components/`, not inline in page files.
- Grade values are exactly `'pass' | 'merit' | 'distinction' | 'not_yet_achieved'` — no other strings, no free text.

---

### Task 1: Migration — `assignment_grades` table

**Files:**
- Create: `supabase/migrations/047_assignment_grades.sql`

**Interfaces:**
- Produces: table `assignment_grades(id, assignment_id, student_id, grade, graded_by, graded_at, updated_at)`, unique on `(assignment_id, student_id)`. Every later task's SQL references this exact shape.

- [ ] **Step 1: Write the migration**

```sql
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
```

- [ ] **Step 2: Apply the migration**

Use the Supabase MCP `apply_migration` tool (or paste into the Supabase Dashboard SQL Editor) against project `avpdwutgtsurddvfxhmh`, name `047_assignment_grades`.

- [ ] **Step 3: Verify**

```sql
select column_name, data_type from information_schema.columns
where table_schema = 'public' and table_name = 'assignment_grades'
order by ordinal_position;
```

Expected: 7 rows — `id`, `assignment_id`, `student_id`, `grade`, `graded_by`, `graded_at`, `updated_at`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/047_assignment_grades.sql
git commit -m "feat: add assignment_grades table for BTEC coursework outcomes

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

### Task 2: `lib/coursework/courseworkUtils.ts` — pure helpers

**Files:**
- Create: `lib/coursework/courseworkUtils.ts`
- Test: `__tests__/lib/coursework/courseworkUtils.test.ts`

**Interfaces:**
- Consumes: nothing (pure, dependency-free).
- Produces: `CourseworkGrade` type, `VALID_COURSEWORK_GRADES: CourseworkGrade[]`, `GRADE_LABELS: Record<CourseworkGrade, string>`, `GRADE_COLOURS: Record<CourseworkGrade, string>`, `BtecUnitRow`, `AssignmentRow`, `AssignmentWithGrade = AssignmentRow & { grade: CourseworkGrade | null }`, `GroupedUnit = { unit: BtecUnitRow; assignments: AssignmentWithGrade[] }`, `groupAssignmentsByUnit(assignments: AssignmentWithGrade[], units: BtecUnitRow[]): GroupedUnit[]`. Every later task that touches coursework data imports these exact names.

- [ ] **Step 1: Write the failing tests**

```typescript
// __tests__/lib/coursework/courseworkUtils.test.ts
import {
  groupAssignmentsByUnit,
  GRADE_LABELS,
  GRADE_COLOURS,
  VALID_COURSEWORK_GRADES,
  type BtecUnitRow,
  type AssignmentWithGrade,
} from '@/lib/coursework/courseworkUtils'

const units: BtecUnitRow[] = [
  { id: 'u1', course_id: 'c1', unit_number: 'U01', unit_name: 'Anatomy and Physiology' },
  { id: 'u2', course_id: 'c1', unit_number: 'U04', unit_name: 'Sports Leadership' },
  { id: 'u3', course_id: 'c1', unit_number: 'U08', unit_name: 'Coaching for Performance' },
]

function assignment(overrides: Partial<AssignmentWithGrade>): AssignmentWithGrade {
  return {
    id: 'a1',
    unit_id: 'u1',
    title: 'Assignment 1',
    description: null,
    due_date: '2026-10-01',
    grade_target: 'merit',
    grade: null,
    ...overrides,
  }
}

describe('groupAssignmentsByUnit', () => {
  it('groups assignments under their unit', () => {
    const assignments = [
      assignment({ id: 'a1', unit_id: 'u1', due_date: '2026-10-01' }),
      assignment({ id: 'a2', unit_id: 'u2', due_date: '2026-10-05' }),
    ]

    const result = groupAssignmentsByUnit(assignments, units)

    expect(result).toHaveLength(2)
    expect(result[0].unit.id).toBe('u1')
    expect(result[0].assignments).toHaveLength(1)
    expect(result[0].assignments[0].id).toBe('a1')
    expect(result[1].unit.id).toBe('u2')
  })

  it('sorts assignments within a unit by due date ascending', () => {
    const assignments = [
      assignment({ id: 'later', unit_id: 'u1', due_date: '2026-11-01' }),
      assignment({ id: 'earlier', unit_id: 'u1', due_date: '2026-10-01' }),
    ]

    const result = groupAssignmentsByUnit(assignments, units)

    expect(result[0].assignments.map(a => a.id)).toEqual(['earlier', 'later'])
  })

  it('drops units with no assignments', () => {
    const assignments = [assignment({ id: 'a1', unit_id: 'u1' })]

    const result = groupAssignmentsByUnit(assignments, units)

    expect(result).toHaveLength(1)
    expect(result[0].unit.id).toBe('u1')
  })

  it('returns an empty array when no assignments exist', () => {
    expect(groupAssignmentsByUnit([], units)).toEqual([])
  })
})

describe('GRADE_LABELS / GRADE_COLOURS / VALID_COURSEWORK_GRADES', () => {
  it('has a label and colour for every valid grade', () => {
    for (const grade of VALID_COURSEWORK_GRADES) {
      expect(GRADE_LABELS[grade]).toBeTruthy()
      expect(GRADE_COLOURS[grade]).toBeTruthy()
    }
  })

  it('exposes exactly the 4 BTEC outcome values', () => {
    expect(VALID_COURSEWORK_GRADES).toEqual(['pass', 'merit', 'distinction', 'not_yet_achieved'])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- courseworkUtils`
Expected: FAIL — `Cannot find module '@/lib/coursework/courseworkUtils'`

- [ ] **Step 3: Write the implementation**

```typescript
// lib/coursework/courseworkUtils.ts
// Pure helpers for coursework grade tracking — dependency-free, so grouping
// and label logic is unit-testable without touching Supabase.

export type CourseworkGrade = 'pass' | 'merit' | 'distinction' | 'not_yet_achieved'

export const VALID_COURSEWORK_GRADES: CourseworkGrade[] = [
  'pass',
  'merit',
  'distinction',
  'not_yet_achieved',
]

export const GRADE_LABELS: Record<CourseworkGrade, string> = {
  pass: 'Pass',
  merit: 'Merit',
  distinction: 'Distinction',
  not_yet_achieved: 'Not yet achieved',
}

export const GRADE_COLOURS: Record<CourseworkGrade, string> = {
  pass: 'bg-gray-100 text-gray-800 border-gray-300',
  merit: 'bg-blue-100 text-blue-800 border-blue-200',
  distinction: 'bg-green-100 text-green-800 border-green-200',
  not_yet_achieved: 'bg-amber-100 text-amber-800 border-amber-200',
}

export type BtecUnitRow = {
  id: string
  course_id: string
  unit_number: string
  unit_name: string
}

export type AssignmentRow = {
  id: string
  unit_id: string
  title: string
  description: string | null
  due_date: string
  grade_target: string | null
}

export type AssignmentWithGrade = AssignmentRow & { grade: CourseworkGrade | null }

export type GroupedUnit = {
  unit: BtecUnitRow
  assignments: AssignmentWithGrade[]
}

/**
 * Groups assignments under their BTEC unit, sorted by due date within each
 * unit. Units with no assignments are dropped — nothing useful to show a
 * student/parent. (The admin manager shows every unit including empty
 * ones, so it does its own filtering rather than using this helper.)
 */
export function groupAssignmentsByUnit(
  assignments: AssignmentWithGrade[],
  units: BtecUnitRow[],
): GroupedUnit[] {
  return units
    .map(unit => ({
      unit,
      assignments: assignments
        .filter(a => a.unit_id === unit.id)
        .slice()
        .sort((a, b) => a.due_date.localeCompare(b.due_date)),
    }))
    .filter(group => group.assignments.length > 0)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- courseworkUtils`
Expected: PASS — 6 tests

- [ ] **Step 5: Commit**

```bash
git add lib/coursework/courseworkUtils.ts __tests__/lib/coursework/courseworkUtils.test.ts
git commit -m "feat: add coursework grade types and grouping helper

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

### Task 3: `POST /api/admin/assignments`

**Files:**
- Create: `app/api/admin/assignments/route.ts`
- Test: `__tests__/lib/coursework/assignmentsRoute.test.ts`

**Interfaces:**
- Consumes: `requireStaff()` from `lib/auth/requireRole.ts`.
- Produces: `POST` handler validating `title`, `due_date`, `unit_id` (must reference a real `btec_units` row), inserting into `assignments`.

- [ ] **Step 1: Write the failing tests**

```typescript
// __tests__/lib/coursework/assignmentsRoute.test.ts
/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'

const requireStaffMock = jest.fn()
const adminFromMock = jest.fn()

jest.mock('@/lib/auth/requireRole', () => ({
  requireStaff: () => requireStaffMock(),
}))

import { POST } from '@/app/api/admin/assignments/route'

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/admin/assignments', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

function validBody(): Record<string, unknown> {
  return {
    unit_id: 'unit-1',
    title: 'Coaching Portfolio',
    description: 'Write up your coaching sessions',
    due_date: '2026-10-15',
    grade_target: 'merit',
  }
}

function setupAdmin(options: { unitExists?: boolean } = {}) {
  const { unitExists = true } = options
  const unitMaybeSingleMock = jest.fn(async () => ({
    data: unitExists ? { id: 'unit-1' } : null,
    error: null,
  }))
  const unitEqMock = jest.fn(() => ({ maybeSingle: unitMaybeSingleMock }))
  const unitSelectMock = jest.fn(() => ({ eq: unitEqMock }))

  const insertSingleMock = jest.fn(async () => ({
    data: { id: 'a1', ...validBody(), created_at: '2026-09-01T00:00:00Z' },
    error: null,
  }))
  const insertSelectMock = jest.fn(() => ({ single: insertSingleMock }))
  const insertMock = jest.fn(() => ({ select: insertSelectMock }))

  adminFromMock.mockImplementation((table: string) => {
    if (table === 'btec_units') return { select: unitSelectMock }
    if (table === 'assignments') return { insert: insertMock }
    throw new Error(`Unexpected table ${table}`)
  })
  return { insertMock }
}

function authorizeAsStaff() {
  requireStaffMock.mockResolvedValue({
    ok: true,
    ctx: { user: { id: 'u1' }, role: 'admin', admin: { from: adminFromMock } },
  })
}

beforeEach(() => {
  requireStaffMock.mockReset()
  adminFromMock.mockReset()
})

describe('POST /api/admin/assignments', () => {
  it('creates an assignment when the unit exists', async () => {
    authorizeAsStaff()
    const { insertMock } = setupAdmin()

    const res = await POST(makeRequest(validBody()))

    expect(res.status).toBe(200)
    expect(insertMock).toHaveBeenCalledTimes(1)
    const payload = insertMock.mock.calls[0][0] as { unit_id: string; title: string }
    expect(payload.unit_id).toBe('unit-1')
    expect(payload.title).toBe('Coaching Portfolio')
  })

  it('returns 400 when title is missing', async () => {
    authorizeAsStaff()
    setupAdmin()
    const { title, ...bodyWithoutTitle } = validBody()

    const res = await POST(makeRequest(bodyWithoutTitle))

    expect(res.status).toBe(400)
  })

  it('returns 400 when due_date is missing', async () => {
    authorizeAsStaff()
    setupAdmin()
    const { due_date, ...bodyWithoutDueDate } = validBody()

    const res = await POST(makeRequest(bodyWithoutDueDate))

    expect(res.status).toBe(400)
  })

  it('returns 400 when unit_id is missing', async () => {
    authorizeAsStaff()
    setupAdmin()
    const { unit_id, ...bodyWithoutUnitId } = validBody()

    const res = await POST(makeRequest(bodyWithoutUnitId))

    expect(res.status).toBe(400)
  })

  it('returns 400 when unit_id does not reference a real unit', async () => {
    authorizeAsStaff()
    setupAdmin({ unitExists: false })

    const res = await POST(makeRequest(validBody()))

    expect(res.status).toBe(400)
  })

  it('returns the auth response when the caller is not staff', async () => {
    const { NextResponse } = await import('next/server')
    requireStaffMock.mockResolvedValue({ ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) })

    const res = await POST(makeRequest(validBody()))

    expect(res.status).toBe(403)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- assignmentsRoute`
Expected: FAIL — `Cannot find module '@/app/api/admin/assignments/route'`

- [ ] **Step 3: Write the implementation**

```typescript
// app/api/admin/assignments/route.ts
import { requireStaff } from '@/lib/auth/requireRole'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const auth = await requireStaff()
  if (!auth.ok) return auth.response
  const { admin } = auth.ctx

  const body = await request.json()
  const { unit_id, title, description, due_date, grade_target } = body as {
    unit_id?: string
    title?: string
    description?: string | null
    due_date?: string
    grade_target?: string | null
  }

  if (!title?.trim()) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }
  if (!due_date) {
    return NextResponse.json({ error: 'due_date is required' }, { status: 400 })
  }
  if (!unit_id) {
    return NextResponse.json({ error: 'unit_id is required' }, { status: 400 })
  }

  const { data: unit } = await admin
    .from('btec_units')
    .select('id')
    .eq('id', unit_id)
    .maybeSingle()

  if (!unit) {
    return NextResponse.json({ error: 'unit_id does not reference a real unit' }, { status: 400 })
  }

  const { data, error } = await admin
    .from('assignments')
    .insert({
      unit_id,
      title: title.trim(),
      description: description?.trim() || null,
      due_date,
      grade_target: grade_target?.trim() || null,
    })
    .select('id, unit_id, title, description, due_date, grade_target, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ assignment: data })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- assignmentsRoute`
Expected: PASS — 6 tests

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/assignments/route.ts __tests__/lib/coursework/assignmentsRoute.test.ts
git commit -m "feat: add POST /api/admin/assignments

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

### Task 4: `PATCH`/`DELETE /api/admin/assignments/[assignmentId]`

**Files:**
- Create: `app/api/admin/assignments/[assignmentId]/route.ts`
- Test: `__tests__/lib/coursework/assignmentsIdRoute.test.ts`

**Interfaces:**
- Consumes: `requireStaff()`.
- Produces: `PATCH`/`DELETE` handlers, same URL shape as `/api/admin/timetable-slots/[slotId]`.

- [ ] **Step 1: Write the failing tests**

```typescript
// __tests__/lib/coursework/assignmentsIdRoute.test.ts
/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'

const requireStaffMock = jest.fn()
const adminFromMock = jest.fn()

jest.mock('@/lib/auth/requireRole', () => ({
  requireStaff: () => requireStaffMock(),
}))

import { PATCH, DELETE } from '@/app/api/admin/assignments/[assignmentId]/route'

function makeRequest(method: string, body?: unknown): NextRequest {
  return new NextRequest('http://localhost/api/admin/assignments/a1', {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: { 'Content-Type': 'application/json' },
  })
}

function validBody(): Record<string, unknown> {
  return {
    title: 'Coaching Portfolio (revised)',
    description: 'Updated brief',
    due_date: '2026-10-20',
    grade_target: 'distinction',
  }
}

function setupAdmin() {
  const updateEqMock = jest.fn(async () => ({ error: null }))
  const updateMock = jest.fn(() => ({ eq: updateEqMock }))
  const deleteEqMock = jest.fn(async () => ({ error: null }))
  const deleteMock = jest.fn(() => ({ eq: deleteEqMock }))

  adminFromMock.mockImplementation((table: string) => {
    if (table === 'assignments') return { update: updateMock, delete: deleteMock }
    throw new Error(`Unexpected table ${table}`)
  })
  return { updateMock, updateEqMock, deleteMock, deleteEqMock }
}

function authorizeAsStaff() {
  requireStaffMock.mockResolvedValue({
    ok: true,
    ctx: { user: { id: 'u1' }, role: 'admin', admin: { from: adminFromMock } },
  })
}

beforeEach(() => {
  requireStaffMock.mockReset()
  adminFromMock.mockReset()
})

describe('PATCH /api/admin/assignments/[assignmentId]', () => {
  it('updates an assignment', async () => {
    authorizeAsStaff()
    const { updateMock, updateEqMock } = setupAdmin()

    const res = await PATCH(makeRequest('PATCH', validBody()), { params: { assignmentId: 'a1' } })

    expect(res.status).toBe(200)
    expect(updateMock).toHaveBeenCalledTimes(1)
    expect(updateEqMock).toHaveBeenCalledWith('id', 'a1')
  })

  it('returns 400 when title is missing', async () => {
    authorizeAsStaff()
    setupAdmin()
    const { title, ...bodyWithoutTitle } = validBody()

    const res = await PATCH(makeRequest('PATCH', bodyWithoutTitle), { params: { assignmentId: 'a1' } })

    expect(res.status).toBe(400)
  })

  it('returns the auth response when the caller is not staff', async () => {
    const { NextResponse } = await import('next/server')
    requireStaffMock.mockResolvedValue({ ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) })

    const res = await PATCH(makeRequest('PATCH', validBody()), { params: { assignmentId: 'a1' } })

    expect(res.status).toBe(403)
  })
})

describe('DELETE /api/admin/assignments/[assignmentId]', () => {
  it('deletes an assignment', async () => {
    authorizeAsStaff()
    const { deleteMock, deleteEqMock } = setupAdmin()

    const res = await DELETE(makeRequest('DELETE'), { params: { assignmentId: 'a1' } })

    expect(res.status).toBe(200)
    expect(deleteMock).toHaveBeenCalledTimes(1)
    expect(deleteEqMock).toHaveBeenCalledWith('id', 'a1')
  })

  it('returns the auth response when the caller is not staff', async () => {
    const { NextResponse } = await import('next/server')
    requireStaffMock.mockResolvedValue({ ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) })

    const res = await DELETE(makeRequest('DELETE'), { params: { assignmentId: 'a1' } })

    expect(res.status).toBe(403)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- assignmentsIdRoute`
Expected: FAIL — `Cannot find module '@/app/api/admin/assignments/[assignmentId]/route'`

- [ ] **Step 3: Write the implementation**

```typescript
// app/api/admin/assignments/[assignmentId]/route.ts
import { requireStaff } from '@/lib/auth/requireRole'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { assignmentId: string } }
) {
  const auth = await requireStaff()
  if (!auth.ok) return auth.response
  const { admin } = auth.ctx

  const body = await request.json()
  const { title, description, due_date, grade_target } = body as {
    title?: string
    description?: string | null
    due_date?: string
    grade_target?: string | null
  }

  if (!title?.trim()) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }
  if (!due_date) {
    return NextResponse.json({ error: 'due_date is required' }, { status: 400 })
  }

  const { error } = await admin
    .from('assignments')
    .update({
      title: title.trim(),
      description: description?.trim() || null,
      due_date,
      grade_target: grade_target?.trim() || null,
    })
    .eq('id', params.assignmentId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { assignmentId: string } }
) {
  const auth = await requireStaff()
  if (!auth.ok) return auth.response
  const { admin } = auth.ctx

  const { error } = await admin.from('assignments').delete().eq('id', params.assignmentId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- assignmentsIdRoute`
Expected: PASS — 5 tests

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/assignments/[assignmentId]/route.ts __tests__/lib/coursework/assignmentsIdRoute.test.ts
git commit -m "feat: add PATCH/DELETE /api/admin/assignments/[assignmentId]

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

### Task 5: `POST /api/admin/assignments/[assignmentId]/grades` — bulk upsert

**Files:**
- Create: `app/api/admin/assignments/[assignmentId]/grades/route.ts`
- Test: `__tests__/lib/coursework/assignmentGradesRoute.test.ts`

**Interfaces:**
- Consumes: `requireStaff()`; `VALID_COURSEWORK_GRADES` from `lib/coursework/courseworkUtils.ts` (Task 2).
- Produces: `POST` handler taking `{ grades: Array<{ student_id: string; grade: string | null }> }`, validating every row before writing any, upserting into `assignment_grades` on `(assignment_id, student_id)`.

- [ ] **Step 1: Write the failing tests**

```typescript
// __tests__/lib/coursework/assignmentGradesRoute.test.ts
/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'

const requireStaffMock = jest.fn()
const adminFromMock = jest.fn()

jest.mock('@/lib/auth/requireRole', () => ({
  requireStaff: () => requireStaffMock(),
}))

import { POST } from '@/app/api/admin/assignments/[assignmentId]/grades/route'

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/admin/assignments/a1/grades', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

function validBody(): Record<string, unknown> {
  return {
    grades: [
      { student_id: 's1', grade: 'merit' },
      { student_id: 's2', grade: null },
    ],
  }
}

function setupAdmin(options: { eligibleIds?: string[] } = {}) {
  const { eligibleIds = ['s1', 's2'] } = options

  const assignmentMaybeSingleMock = jest.fn(async () => ({ data: { id: 'a1', unit_id: 'unit-1' }, error: null }))
  const assignmentEqMock = jest.fn(() => ({ maybeSingle: assignmentMaybeSingleMock }))
  const assignmentSelectMock = jest.fn(() => ({ eq: assignmentEqMock }))

  const unitMaybeSingleMock = jest.fn(async () => ({ data: { id: 'unit-1', course_id: 'c1' }, error: null }))
  const unitEqMock = jest.fn(() => ({ maybeSingle: unitMaybeSingleMock }))
  const unitSelectMock = jest.fn(() => ({ eq: unitEqMock }))

  const usersSecondEqMock = jest.fn(async () => ({
    data: eligibleIds.map(id => ({ id })),
    error: null,
  }))
  const usersFirstEqMock = jest.fn(() => ({ eq: usersSecondEqMock }))
  const usersSelectMock = jest.fn(() => ({ eq: usersFirstEqMock }))

  const upsertMock = jest.fn(async () => ({ error: null }))

  adminFromMock.mockImplementation((table: string) => {
    if (table === 'assignments') return { select: assignmentSelectMock }
    if (table === 'btec_units') return { select: unitSelectMock }
    if (table === 'users') return { select: usersSelectMock }
    if (table === 'assignment_grades') return { upsert: upsertMock }
    throw new Error(`Unexpected table ${table}`)
  })

  return { upsertMock }
}

function authorizeAsStaff() {
  requireStaffMock.mockResolvedValue({
    ok: true,
    ctx: { user: { id: 'staff-1' }, role: 'admin', admin: { from: adminFromMock } },
  })
}

beforeEach(() => {
  requireStaffMock.mockReset()
  adminFromMock.mockReset()
})

describe('POST /api/admin/assignments/[assignmentId]/grades', () => {
  it('upserts a grade row per student', async () => {
    authorizeAsStaff()
    const { upsertMock } = setupAdmin()

    const res = await POST(makeRequest(validBody()), { params: { assignmentId: 'a1' } })

    expect(res.status).toBe(200)
    expect(upsertMock).toHaveBeenCalledTimes(1)
    const [rows, options] = upsertMock.mock.calls[0] as [
      Array<{ assignment_id: string; student_id: string; grade: string | null }>,
      { onConflict: string }
    ]
    expect(options).toEqual({ onConflict: 'assignment_id,student_id' })
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ assignment_id: 'a1', student_id: 's1', grade: 'merit' })
    expect(rows[1]).toMatchObject({ assignment_id: 'a1', student_id: 's2', grade: null })
  })

  it('returns 400 when grades is missing or empty', async () => {
    authorizeAsStaff()
    setupAdmin()

    const res = await POST(makeRequest({ grades: [] }), { params: { assignmentId: 'a1' } })

    expect(res.status).toBe(400)
  })

  it('returns 400 when a grade value is invalid', async () => {
    authorizeAsStaff()
    setupAdmin()

    const res = await POST(
      makeRequest({ grades: [{ student_id: 's1', grade: 'A-star' }] }),
      { params: { assignmentId: 'a1' } }
    )

    expect(res.status).toBe(400)
  })

  it('returns 400 when a student is not enrolled on the course', async () => {
    authorizeAsStaff()
    setupAdmin({ eligibleIds: ['s1'] }) // s2 not eligible

    const res = await POST(makeRequest(validBody()), { params: { assignmentId: 'a1' } })

    expect(res.status).toBe(400)
  })

  it('returns 404 when the assignment does not exist', async () => {
    authorizeAsStaff()
    const assignmentMaybeSingleMock = jest.fn(async () => ({ data: null, error: null }))
    const assignmentEqMock = jest.fn(() => ({ maybeSingle: assignmentMaybeSingleMock }))
    const assignmentSelectMock = jest.fn(() => ({ eq: assignmentEqMock }))
    adminFromMock.mockImplementation((table: string) => {
      if (table === 'assignments') return { select: assignmentSelectMock }
      throw new Error(`Unexpected table ${table}`)
    })

    const res = await POST(makeRequest(validBody()), { params: { assignmentId: 'missing' } })

    expect(res.status).toBe(404)
  })

  it('returns the auth response when the caller is not staff', async () => {
    const { NextResponse } = await import('next/server')
    requireStaffMock.mockResolvedValue({ ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) })

    const res = await POST(makeRequest(validBody()), { params: { assignmentId: 'a1' } })

    expect(res.status).toBe(403)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- assignmentGradesRoute`
Expected: FAIL — `Cannot find module '@/app/api/admin/assignments/[assignmentId]/grades/route'`

- [ ] **Step 3: Write the implementation**

```typescript
// app/api/admin/assignments/[assignmentId]/grades/route.ts
import { requireStaff } from '@/lib/auth/requireRole'
import { VALID_COURSEWORK_GRADES } from '@/lib/coursework/courseworkUtils'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

type GradeInput = { student_id?: string; grade?: string | null }

export async function POST(
  request: NextRequest,
  { params }: { params: { assignmentId: string } }
) {
  const auth = await requireStaff()
  if (!auth.ok) return auth.response
  const { user, admin } = auth.ctx

  const body = await request.json()
  const { grades } = body as { grades?: GradeInput[] }

  if (!Array.isArray(grades) || grades.length === 0) {
    return NextResponse.json({ error: 'grades must be a non-empty array' }, { status: 400 })
  }

  for (const g of grades) {
    if (!g.student_id) {
      return NextResponse.json({ error: 'every grade entry needs a student_id' }, { status: 400 })
    }
    if (g.grade !== null && g.grade !== undefined && !VALID_COURSEWORK_GRADES.includes(g.grade as (typeof VALID_COURSEWORK_GRADES)[number])) {
      return NextResponse.json({ error: `invalid grade value: ${g.grade}` }, { status: 400 })
    }
  }

  const { data: assignment } = await admin
    .from('assignments')
    .select('id, unit_id')
    .eq('id', params.assignmentId)
    .maybeSingle()

  if (!assignment) {
    return NextResponse.json({ error: 'assignment not found' }, { status: 404 })
  }

  const { data: unit } = await admin
    .from('btec_units')
    .select('id, course_id')
    .eq('id', assignment.unit_id)
    .maybeSingle()

  if (!unit) {
    return NextResponse.json({ error: 'assignment has no valid unit' }, { status: 500 })
  }

  const { data: eligibleStudents } = await admin
    .from('users')
    .select('id')
    .eq('role', 'student')
    .eq('course_id', unit.course_id)

  const eligibleIds = new Set((eligibleStudents ?? []).map(s => s.id))

  for (const g of grades) {
    if (!eligibleIds.has(g.student_id as string)) {
      return NextResponse.json({ error: `student ${g.student_id} is not enrolled on this assignment's course` }, { status: 400 })
    }
  }

  const now = new Date().toISOString()
  const rows = grades.map(g => ({
    assignment_id: params.assignmentId,
    student_id: g.student_id,
    grade: g.grade ?? null,
    graded_by: user.id,
    graded_at: g.grade ? now : null,
    updated_at: now,
  }))

  const { error } = await admin
    .from('assignment_grades')
    .upsert(rows, { onConflict: 'assignment_id,student_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- assignmentGradesRoute`
Expected: PASS — 6 tests

- [ ] **Step 5: Commit**

```bash
git add "app/api/admin/assignments/[assignmentId]/grades/route.ts" __tests__/lib/coursework/assignmentGradesRoute.test.ts
git commit -m "feat: add bulk grade upsert route

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

### Task 6: Admin coursework page + `CourseworkManager` (assignment CRUD)

**Files:**
- Create: `app/(admin)/admin/coursework/page.tsx`
- Create: `app/(admin)/admin/coursework/CourseworkManager.tsx`

**Interfaces:**
- Consumes: `BtecUnitRow`, `AssignmentRow` from `lib/coursework/courseworkUtils.ts` (Task 2); `POST/PATCH/DELETE /api/admin/assignments[/:id]` (Tasks 3–4).
- Produces: `CourseworkManager({ units, assignments }: { units: BtecUnitRow[]; assignments: AssignmentRow[] })` — no test (matches `TimetableManager`/`CalendarEventsManager` precedent: form/CRUD components are verified by hand, not unit tested).

- [ ] **Step 1: Write `CourseworkManager.tsx`**

```tsx
// app/(admin)/admin/coursework/CourseworkManager.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CalendarPlus, Pencil, Trash2, ClipboardCheck } from 'lucide-react'
import type { BtecUnitRow, AssignmentRow } from '@/lib/coursework/courseworkUtils'

type Props = { units: BtecUnitRow[]; assignments: AssignmentRow[] }

const EMPTY_FORM = { title: '', description: '', due_date: '', grade_target: '' }

export function CourseworkManager({ units, assignments }: Props) {
  const router = useRouter()
  const [activeUnitId, setActiveUnitId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function startAdd(unitId: string) {
    setActiveUnitId(unitId)
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  function startEdit(unitId: string, assignment: AssignmentRow) {
    setActiveUnitId(unitId)
    setEditingId(assignment.id)
    setForm({
      title: assignment.title,
      description: assignment.description ?? '',
      due_date: assignment.due_date,
      grade_target: assignment.grade_target ?? '',
    })
  }

  function cancel() {
    setActiveUnitId(null)
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  async function submit(e: React.FormEvent, unitId: string) {
    e.preventDefault()
    if (!form.title.trim() || !form.due_date) return
    setLoading(true)
    const body = {
      unit_id: unitId,
      title: form.title.trim(),
      description: form.description.trim() || null,
      due_date: form.due_date,
      grade_target: form.grade_target.trim() || null,
    }
    const res = await fetch(
      editingId ? `/api/admin/assignments/${editingId}` : '/api/admin/assignments',
      {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    )
    const data = await res.json()
    setLoading(false)
    if (res.ok) {
      cancel()
      router.refresh()
    } else {
      alert(data.error ?? 'Failed to save assignment')
    }
  }

  async function remove(id: string, title: string) {
    if (!confirm(`Delete "${title}"?`)) return
    const res = await fetch(`/api/admin/assignments/${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (res.ok) {
      if (editingId === id) cancel()
      router.refresh()
    } else {
      alert(data.error ?? 'Failed to delete assignment')
    }
  }

  return (
    <div className="space-y-6">
      {units.map(unit => {
        const unitAssignments = assignments.filter(a => a.unit_id === unit.id)
        const isAdding = activeUnitId === unit.id

        return (
          <div key={unit.id} className="space-y-2">
            <p className="text-sm font-semibold text-tranmere-blue">
              {unit.unit_number} · {unit.unit_name}
            </p>

            <div className="space-y-2">
              {unitAssignments.length === 0 && !isAdding && (
                <p className="text-sm text-muted-foreground">No assignments yet.</p>
              )}
              {unitAssignments.map(assignment => (
                <div key={assignment.id} className="flex items-start gap-3 rounded-xl border bg-white p-3 shadow-sm">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-tranmere-blue">
                      Due {new Date(assignment.due_date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                    <p className="text-sm font-medium truncate">{assignment.title}</p>
                    {assignment.grade_target && (
                      <p className="text-xs text-muted-foreground mt-0.5">Target: {assignment.grade_target}</p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Link
                      href={`/admin/coursework?course=${unit.course_id}&grade=${assignment.id}`}
                      aria-label={`Grade ${assignment.title}`}
                      className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
                    >
                      <ClipboardCheck size={15} />
                    </Link>
                    <button
                      onClick={() => startEdit(unit.id, assignment)}
                      aria-label={`Edit ${assignment.title}`}
                      className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => remove(assignment.id, assignment.title)}
                      aria-label={`Delete ${assignment.title}`}
                      className="p-2 rounded-lg hover:bg-red-50 text-red-500"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {isAdding ? (
              <form onSubmit={e => submit(e, unit.id)} className="rounded-2xl border bg-white p-4 space-y-3 shadow-sm">
                <p className="text-sm font-semibold text-tranmere-blue">
                  {editingId ? 'Edit assignment' : 'Add assignment'}
                </p>
                <input
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Title, e.g. Coaching Portfolio"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-tranmere-blue outline-none"
                  required
                />
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Description (optional)"
                  rows={2}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-tranmere-blue outline-none"
                />
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={form.due_date}
                    onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                    className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-tranmere-blue outline-none"
                    required
                  />
                  <input
                    value={form.grade_target}
                    onChange={e => setForm(f => ({ ...f, grade_target: e.target.value }))}
                    placeholder="Target grade (optional)"
                    className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-tranmere-blue outline-none"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={!form.title.trim() || !form.due_date || loading}
                    className="flex items-center gap-1.5 bg-tranmere-blue text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-blue-900 transition-colors"
                  >
                    <CalendarPlus size={15} />
                    {loading ? 'Saving…' : editingId ? 'Save changes' : 'Add assignment'}
                  </button>
                  <button
                    type="button"
                    onClick={cancel}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => startAdd(unit.id)}
                className="text-sm font-medium text-tranmere-blue hover:underline"
              >
                + Add assignment
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Write `page.tsx`**

```tsx
// app/(admin)/admin/coursework/page.tsx
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { CourseworkManager } from './CourseworkManager'
import type { BtecUnitRow, AssignmentRow } from '@/lib/coursework/courseworkUtils'

export const dynamic = 'force-dynamic'

export default async function AdminCourseworkPage({
  searchParams,
}: {
  searchParams: { course?: string; grade?: string }
}) {
  const supabase = createAdminClient()

  const { data: courses } = await supabase.from('courses').select('id, name').order('name')
  const courseList = courses ?? []
  const selectedCourseId = searchParams.course && courseList.some(c => c.id === searchParams.course)
    ? searchParams.course
    : courseList[0]?.id

  const { data: units } = selectedCourseId
    ? await supabase
        .from('btec_units')
        .select('id, course_id, unit_number, unit_name')
        .eq('course_id', selectedCourseId)
        .order('unit_number')
    : { data: [] as BtecUnitRow[] }

  const unitList = units ?? []
  const unitIds = unitList.map(u => u.id)

  const { data: assignments } = unitIds.length
    ? await supabase
        .from('assignments')
        .select('id, unit_id, title, description, due_date, grade_target')
        .in('unit_id', unitIds)
        .order('due_date')
    : { data: [] as AssignmentRow[] }

  const assignmentList = assignments ?? []

  return (
    <div className="space-y-4">
      <div className="py-2">
        <h1 className="text-lg font-bold text-tranmere-blue">Coursework</h1>
        <p className="text-xs text-muted-foreground">
          Manage assignment deadlines and record BTEC grades by course.
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {courseList.map(course => (
          <Link
            key={course.id}
            href={`/admin/coursework?course=${course.id}`}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              course.id === selectedCourseId
                ? 'bg-tranmere-blue text-white'
                : 'bg-white border text-gray-600 hover:bg-gray-50'
            }`}
          >
            {course.name}
          </Link>
        ))}
      </div>

      <CourseworkManager units={unitList} assignments={assignmentList} />
    </div>
  )
}
```

Note: the `?grade=` search param is read here as a prop but not yet used — Task 7 adds the grade-sheet section that reads it.

- [ ] **Step 3: Verify — typecheck, lint, build**

```bash
npx tsc --noEmit 2>&1 | grep -E "admin/coursework"
npx eslint "app/(admin)/admin/coursework/page.tsx" "app/(admin)/admin/coursework/CourseworkManager.tsx"
npm run build
```

Expected: no output from the `tsc`/`grep` line, no eslint errors, build succeeds.

- [ ] **Step 4: Commit**

```bash
git add "app/(admin)/admin/coursework/page.tsx" "app/(admin)/admin/coursework/CourseworkManager.tsx"
git commit -m "feat: add admin coursework page with assignment CRUD

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

### Task 7: `GradeSheet` — bulk grade entry, wired into the admin page

**Files:**
- Create: `app/(admin)/admin/coursework/GradeSheet.tsx`
- Modify: `app/(admin)/admin/coursework/page.tsx`

**Interfaces:**
- Consumes: `GRADE_LABELS`, `VALID_COURSEWORK_GRADES`, `CourseworkGrade` from `lib/coursework/courseworkUtils.ts`; `POST /api/admin/assignments/[assignmentId]/grades` (Task 5).
- Produces: `GradeSheet({ assignment, students, grades })` — no test (form component, matches precedent).

- [ ] **Step 1: Write `GradeSheet.tsx`**

```tsx
// app/(admin)/admin/coursework/GradeSheet.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { GRADE_LABELS, VALID_COURSEWORK_GRADES, type CourseworkGrade } from '@/lib/coursework/courseworkUtils'

type Student = { id: string; name: string }
type Props = {
  assignment: { id: string; title: string }
  students: Student[]
  grades: Record<string, string | null>
}

export function GradeSheet({ assignment, students, grades }: Props) {
  const router = useRouter()
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(students.map(s => [s.id, grades[s.id] ?? '']))
  )
  const [loading, setLoading] = useState(false)

  async function save() {
    setLoading(true)
    const body = {
      grades: students.map(s => ({
        student_id: s.id,
        grade: values[s.id] ? values[s.id] : null,
      })),
    }
    const res = await fetch(`/api/admin/assignments/${assignment.id}/grades`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    setLoading(false)
    if (res.ok) {
      router.refresh()
    } else {
      alert(data.error ?? 'Failed to save grades')
    }
  }

  return (
    <div className="rounded-2xl border bg-white p-4 space-y-3 shadow-sm">
      <p className="text-sm font-semibold text-tranmere-blue">Grade: {assignment.title}</p>

      {students.length === 0 ? (
        <p className="text-sm text-muted-foreground">No students on this course yet.</p>
      ) : (
        <div className="space-y-2">
          {students.map(student => (
            <div key={student.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2">
              <span className="text-sm font-medium">{student.name}</span>
              <select
                value={values[student.id] ?? ''}
                onChange={e => setValues(v => ({ ...v, [student.id]: e.target.value }))}
                className="border rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-tranmere-blue outline-none"
              >
                <option value="">— Ungraded —</option>
                {VALID_COURSEWORK_GRADES.map(grade => (
                  <option key={grade} value={grade}>{GRADE_LABELS[grade as CourseworkGrade]}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      {students.length > 0 && (
        <button
          onClick={save}
          disabled={loading}
          className="bg-tranmere-blue text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-blue-900 transition-colors"
        >
          {loading ? 'Saving…' : 'Save all'}
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Wire it into `page.tsx`**

In `app/(admin)/admin/coursework/page.tsx`, add the import and a `gradeSheetData` fetch, then render it:

```tsx
import { GradeSheet } from './GradeSheet'
```

After the `assignmentList` line, add:

```tsx
  type GradeSheetData = {
    assignment: { id: string; title: string }
    students: { id: string; name: string }[]
    grades: Record<string, string | null>
  }

  let gradeSheetData: GradeSheetData | null = null

  if (searchParams.grade) {
    const assignment = assignmentList.find(a => a.id === searchParams.grade)
    if (assignment) {
      const { data: students } = await supabase
        .from('users')
        .select('id, name')
        .eq('role', 'student')
        .eq('course_id', selectedCourseId)
        .order('name')

      const { data: existingGrades } = await supabase
        .from('assignment_grades')
        .select('student_id, grade')
        .eq('assignment_id', searchParams.grade)

      const gradeMap: Record<string, string | null> = {}
      for (const row of existingGrades ?? []) gradeMap[row.student_id] = row.grade

      gradeSheetData = { assignment, students: students ?? [], grades: gradeMap }
    }
  }
```

Then add `{gradeSheetData && <GradeSheet {...gradeSheetData} />}` immediately after `<CourseworkManager units={unitList} assignments={assignmentList} />` in the returned JSX.

- [ ] **Step 3: Verify — typecheck, lint, build**

```bash
npx tsc --noEmit 2>&1 | grep -E "admin/coursework"
npx eslint "app/(admin)/admin/coursework/page.tsx" "app/(admin)/admin/coursework/GradeSheet.tsx"
npm run build
```

Expected: no output from the `tsc`/`grep` line, no eslint errors, build succeeds.

- [ ] **Step 4: Manually verify against the live database**

Using the Supabase MCP `execute_sql` tool against project `avpdwutgtsurddvfxhmh`, confirm at least one real course has students (e.g. "Level 2 Public Services / Fitness" has 10) so the grade sheet has real rows to render once deployed.

- [ ] **Step 5: Commit**

```bash
git add "app/(admin)/admin/coursework/page.tsx" "app/(admin)/admin/coursework/GradeSheet.tsx"
git commit -m "feat: add bulk grade sheet to admin coursework page

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

### Task 8: Calendar integration — append achieved grade to deadline label

**Files:**
- Modify: `lib/calendar/calendarUtils.ts`
- Modify: `__tests__/lib/calendar/calendarUtils.test.ts`

**Interfaces:**
- Consumes: `GRADE_LABELS`, `CourseworkGrade` from `lib/coursework/courseworkUtils.ts` (Task 2).
- Produces: `AssignmentRow` (in `calendarUtils.ts`) gains an optional `grade?: CourseworkGrade | null` field; `getCalendarEvents()`'s deadline label appends `" — {label}"` when present.

- [ ] **Step 1: Write the failing tests**

Add these two `it` blocks inside the existing `describe('getCalendarEvents', ...)` block in `__tests__/lib/calendar/calendarUtils.test.ts`:

```typescript
  it('appends the achieved grade to a deadline label when present', () => {
    const events = getCalendarEvents(
      [],
      [],
      [{ due_date: '2026-10-15', title: 'Coaching Portfolio', grade: 'distinction' }],
    )

    expect(events).toContainEqual(
      expect.objectContaining({ label: 'Coaching Portfolio — Distinction', type: 'deadline' })
    )
  })

  it('leaves the deadline label unchanged when there is no grade yet', () => {
    const events = getCalendarEvents(
      [],
      [],
      [{ due_date: '2026-10-15', title: 'Coaching Portfolio' }],
    )

    expect(events).toContainEqual(
      expect.objectContaining({ label: 'Coaching Portfolio', type: 'deadline' })
    )
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- calendarUtils`
Expected: FAIL — the new tests fail because `grade` isn't on `AssignmentRow` yet and the label never changes.

- [ ] **Step 3: Update `lib/calendar/calendarUtils.ts`**

Add the import at the top of the file:

```typescript
import { GRADE_LABELS, type CourseworkGrade } from '@/lib/coursework/courseworkUtils'
```

Change the `AssignmentRow` type:

```typescript
export type AssignmentRow = {
  due_date: string
  title: string
  grade?: CourseworkGrade | null
}
```

Change the `deadlineEvents` mapping inside `getCalendarEvents`:

```typescript
  const deadlineEvents: CalendarEvent[] = assignments.map(a => ({
    date: a.due_date,
    label: a.grade ? `${a.title} — ${GRADE_LABELS[a.grade]}` : a.title,
    type: 'deadline',
  }))
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- calendarUtils`
Expected: PASS — all existing tests plus the 2 new ones.

- [ ] **Step 5: Commit**

```bash
git add lib/calendar/calendarUtils.ts __tests__/lib/calendar/calendarUtils.test.ts
git commit -m "feat: show achieved grade on calendar deadline events

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

### Task 9: Student `/coursework` page, nav link, calendar wiring

**Files:**
- Create: `components/coursework/CourseworkList.tsx`
- Test: `__tests__/components/coursework/CourseworkList.test.tsx`
- Create: `app/(student)/coursework/page.tsx`
- Modify: `components/layout/SideNav.tsx`
- Modify: `components/layout/BottomNav.tsx`
- Modify: `app/(student)/layout.tsx`
- Modify: `app/(student)/calendar/page.tsx`

**Interfaces:**
- Consumes: `GroupedUnit`, `GRADE_LABELS`, `GRADE_COLOURS`, `groupAssignmentsByUnit`, `AssignmentWithGrade` from `lib/coursework/courseworkUtils.ts`; `CourseworkGrade` from the same module for the calendar page.
- Produces: `CourseworkList({ groups: GroupedUnit[] })`; `SideNav`/`BottomNav` gain `showCoursework?: boolean`.

- [ ] **Step 1: Write the failing test for `CourseworkList`**

```tsx
// __tests__/components/coursework/CourseworkList.test.tsx
import { render, screen } from '@testing-library/react'
import { CourseworkList } from '@/components/coursework/CourseworkList'
import type { GroupedUnit } from '@/lib/coursework/courseworkUtils'

const groups: GroupedUnit[] = [
  {
    unit: { id: 'u1', course_id: 'c1', unit_number: 'U04', unit_name: 'Sports Leadership' },
    assignments: [
      {
        id: 'a1', unit_id: 'u1', title: 'Leadership Portfolio', description: null,
        due_date: '2026-10-15', grade_target: 'merit', grade: 'distinction',
      },
      {
        id: 'a2', unit_id: 'u1', title: 'Leadership Reflection', description: null,
        due_date: '2026-11-01', grade_target: 'pass', grade: null,
      },
    ],
  },
]

describe('CourseworkList', () => {
  it('renders the unit heading and each assignment title', () => {
    render(<CourseworkList groups={groups} />)

    expect(screen.getByText('U04 · Sports Leadership')).toBeInTheDocument()
    expect(screen.getByText('Leadership Portfolio')).toBeInTheDocument()
    expect(screen.getByText('Leadership Reflection')).toBeInTheDocument()
  })

  it('shows the achieved grade badge when graded', () => {
    render(<CourseworkList groups={groups} />)

    expect(screen.getByText('Distinction')).toBeInTheDocument()
  })

  it('shows "Awaiting result" when not yet graded', () => {
    render(<CourseworkList groups={groups} />)

    expect(screen.getByText('Awaiting result')).toBeInTheDocument()
  })

  it('renders a fallback message when there is no coursework', () => {
    render(<CourseworkList groups={[]} />)

    expect(screen.getByText('No coursework set yet.')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- CourseworkList`
Expected: FAIL — `Cannot find module '@/components/coursework/CourseworkList'`

- [ ] **Step 3: Write `CourseworkList.tsx`**

```tsx
// components/coursework/CourseworkList.tsx
import { GRADE_LABELS, GRADE_COLOURS, type GroupedUnit } from '@/lib/coursework/courseworkUtils'

type Props = { groups: GroupedUnit[] }

export function CourseworkList({ groups }: Props) {
  if (groups.length === 0) {
    return <p className="text-sm text-muted-foreground">No coursework set yet.</p>
  }

  return (
    <div className="space-y-4">
      {groups.map(({ unit, assignments }) => (
        <div key={unit.id} className="rounded-2xl border bg-white p-4 shadow-sm space-y-2">
          <p className="text-sm font-semibold text-tranmere-blue">{unit.unit_number} · {unit.unit_name}</p>
          {assignments.map(assignment => (
            <div key={assignment.id} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{assignment.title}</p>
                {assignment.grade ? (
                  <span className={`text-xs font-semibold uppercase tracking-wide rounded-full border px-2 py-0.5 ${GRADE_COLOURS[assignment.grade]}`}>
                    {GRADE_LABELS[assignment.grade]}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">Awaiting result</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Due {new Date(assignment.due_date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                {assignment.grade_target && ` · Target: ${assignment.grade_target}`}
              </p>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- CourseworkList`
Expected: PASS — 4 tests

- [ ] **Step 5: Write `app/(student)/coursework/page.tsx`**

```tsx
// app/(student)/coursework/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CourseworkList } from '@/components/coursework/CourseworkList'
import { groupAssignmentsByUnit, type AssignmentWithGrade } from '@/lib/coursework/courseworkUtils'

export const dynamic = 'force-dynamic'

export default async function CourseworkPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role, course_id')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'student' || !profile.course_id) {
    return (
      <div className="space-y-4">
        <div className="py-2">
          <h1 className="text-lg font-bold text-tranmere-blue">Coursework</h1>
        </div>
        <p className="text-sm text-muted-foreground">No course assigned yet.</p>
      </div>
    )
  }

  const { data: units } = await supabase
    .from('btec_units')
    .select('id, course_id, unit_number, unit_name')
    .eq('course_id', profile.course_id)
    .order('unit_number')

  const unitIds = (units ?? []).map(u => u.id)

  const { data: assignments } = unitIds.length
    ? await supabase
        .from('assignments')
        .select('id, unit_id, title, description, due_date, grade_target')
        .in('unit_id', unitIds)
    : { data: [] }

  const { data: grades } = await supabase
    .from('assignment_grades')
    .select('assignment_id, grade')
    .eq('student_id', user.id)

  const gradeByAssignmentId = new Map((grades ?? []).map(g => [g.assignment_id, g.grade]))

  const assignmentsWithGrade: AssignmentWithGrade[] = (assignments ?? []).map(a => ({
    ...a,
    grade: (gradeByAssignmentId.get(a.id) ?? null) as AssignmentWithGrade['grade'],
  }))

  const groups = groupAssignmentsByUnit(assignmentsWithGrade, units ?? [])

  return (
    <div className="space-y-4">
      <div className="py-2">
        <h1 className="text-lg font-bold text-tranmere-blue">Coursework</h1>
        <p className="text-xs text-muted-foreground">Your BTEC assignments and results</p>
      </div>
      <CourseworkList groups={groups} />
    </div>
  )
}
```

- [ ] **Step 6: Add the nav link — `SideNav.tsx`**

In `components/layout/SideNav.tsx`, add `ClipboardCheck` to the `lucide-react` import, add `showCoursework?: boolean` to `Props`, add the parameter with a default, and insert the nav entry:

```typescript
import { Home, GraduationCap, Apple, Dumbbell, Trophy, User, LogOut, Activity, MessageSquare, Brain, FolderOpen, CalendarClock, ClipboardCheck } from 'lucide-react'
```

```typescript
type Props = {
  userName: string
  avatarUrl: string | null
  role: string
  showTimetable?: boolean
  showCoursework?: boolean
}

export function SideNav({ userName, avatarUrl, role, showTimetable = false, showCoursework = false }: Props) {
```

```typescript
  const nav = [
    { href: '/dashboard', label: 'Home', icon: Home },
    { href: '/documents', label: 'Documents', icon: FolderOpen },
    ...(showTimetable ? [{ href: '/timetable', label: 'Timetable', icon: CalendarClock }] : []),
    ...(showCoursework ? [{ href: '/coursework', label: 'Coursework', icon: ClipboardCheck }] : []),
    { href: MOODLE_STUDENT_URL, label: 'Moodle', icon: GraduationCap, external: true },
    { href: '/nutrition', label: 'Nutrition', icon: Apple },
    { href: '/gps', label: 'GPS Dashboard', icon: Activity },
    { href: '/chat', label: 'Chat', icon: MessageSquare },
    { href: '/training', label: 'Training', icon: Dumbbell },
    { href: '/matches', label: 'Matches', icon: Trophy },
    { href: '/ai-report', label: 'AI Report', icon: Brain },
    { href: '/profile', label: 'Profile', icon: User },
  ]
```

- [ ] **Step 7: Add the nav link — `BottomNav.tsx`**

In `components/layout/BottomNav.tsx`:

```typescript
import { Home, User, Heart, CalendarDays, CalendarClock, Dumbbell, Target, FolderOpen, ClipboardCheck } from 'lucide-react'

type Props = { showTimetable?: boolean; showCoursework?: boolean }

export function BottomNav({ showTimetable = false, showCoursework = false }: Props) {
  const pathname = usePathname()
  const nav = [
    { href: '/dashboard',  label: 'Home',      icon: Home },
    { href: '/documents',  label: 'Documents', icon: FolderOpen },
    { href: '/calendar',   label: 'Calendar',  icon: CalendarDays },
    ...(showTimetable ? [{ href: '/timetable', label: 'Timetable', icon: CalendarClock }] : []),
    ...(showCoursework ? [{ href: '/coursework', label: 'Coursework', icon: ClipboardCheck }] : []),
    { href: '/gym',        label: 'Gym',        icon: Dumbbell },
    { href: '/targets',    label: 'Targets',   icon: Target },
    { href: '/wellbeing',  label: 'Wellbeing', icon: Heart },
    { href: '/profile',    label: 'Profile',   icon: User },
  ]
```

- [ ] **Step 8: Wire the flag in `app/(student)/layout.tsx`**

Change the profile select and add the `showCoursework` computation:

```typescript
  const { data: profile } = await adminClient
    .from('users')
    .select('name, avatar_url, role, year_group, course_id')
    .eq('id', user.id)
    .maybeSingle()
```

```typescript
  const showTimetable =
    profile?.year_group != null && VALID_TIMETABLE_YEAR_GROUPS.includes(profile.year_group)
  const showCoursework = profile?.course_id != null
```

Update both nav renders:

```tsx
        <SideNav userName={profile?.name ?? 'Player'} avatarUrl={profile?.avatar_url ?? null} role={profile?.role ?? 'student'} showTimetable={showTimetable} showCoursework={showCoursework} />
```

```tsx
        <BottomNav showTimetable={showTimetable} showCoursework={showCoursework} />
```

- [ ] **Step 9: Wire achieved grades into the student calendar**

In `app/(student)/calendar/page.tsx`, change the `assignments` query to select `id` too:

```typescript
    supabase
      .from('assignments')
      .select('id, due_date, title')
      .gte('due_date', windowStart)
      .lte('due_date', windowEnd)
      .order('due_date'),
```

Add a 6th parallel query for the student's own grades, and destructure it — the `sessions`/`matches`/`calendarEvents`/`timetableSlots` queries are unchanged, only `assignments` (updated above to select `id`) and the new `assignmentGrades` entry differ from the current file:

```typescript
  const [
    { data: sessions },
    { data: matches },
    { data: assignments },
    { data: calendarEvents },
    { data: timetableSlots },
    { data: assignmentGrades },
  ] = await Promise.all([
```

Add the new query as the 6th array entry, after the existing `timetableSlots` query:

```typescript
    supabase
      .from('assignment_grades')
      .select('assignment_id, grade')
      .eq('student_id', user.id),
  ])
```

After `const classEvents = expandTimetableSlots(...)`, add:

```typescript
  const gradeByAssignmentId = new Map((assignmentGrades ?? []).map(g => [g.assignment_id, g.grade]))
  const flattenedAssignments = (assignments ?? []).map(a => ({
    due_date: a.due_date,
    title: a.title,
    grade: (gradeByAssignmentId.get(a.id) ?? null) as CourseworkGrade | null,
  }))
```

Add the import at the top of the file:

```typescript
import type { CourseworkGrade } from '@/lib/coursework/courseworkUtils'
```

Change the `getCalendarEvents` call to use `flattenedAssignments` instead of `assignments`:

```typescript
  const events = getCalendarEvents(
    sessions  ?? [],
    matches   ?? [],
    flattenedAssignments,
    calendarEvents ?? [],
    classEvents,
  )
```

- [ ] **Step 10: Verify — typecheck, lint, build, full test suite**

```bash
npx tsc --noEmit 2>&1 | grep -E "student\)/coursework|student\)/calendar|student\)/layout|layout/SideNav|layout/BottomNav"
npx eslint "app/(student)/coursework/page.tsx" "app/(student)/calendar/page.tsx" "app/(student)/layout.tsx" "components/layout/SideNav.tsx" "components/layout/BottomNav.tsx" "components/coursework/CourseworkList.tsx"
npm test -- --silent
npm run build
```

Expected: no output from the `tsc`/`grep` line, no eslint errors, full suite passes with the new tests included, build succeeds.

- [ ] **Step 11: Commit**

```bash
git add components/coursework/CourseworkList.tsx __tests__/components/coursework/CourseworkList.test.tsx "app/(student)/coursework/page.tsx" components/layout/SideNav.tsx components/layout/BottomNav.tsx "app/(student)/layout.tsx" "app/(student)/calendar/page.tsx"
git commit -m "feat: add student coursework page, nav link, calendar grade labels

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

### Task 10: Parent `/parent/coursework` page + nav link

**Files:**
- Create: `app/(parent)/parent/coursework/page.tsx`
- Modify: `components/layout/ParentSidebar.tsx`
- Modify: `components/layout/MobileParentBar.tsx`

**Interfaces:**
- Consumes: `CourseworkList` (Task 9); `groupAssignmentsByUnit`, `AssignmentWithGrade` from `lib/coursework/courseworkUtils.ts`.
- Produces: nothing consumed by later tasks — this is the last task.

- [ ] **Step 1: Write `app/(parent)/parent/coursework/page.tsx`**

```tsx
// app/(parent)/parent/coursework/page.tsx
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { CourseworkList } from '@/components/coursework/CourseworkList'
import { groupAssignmentsByUnit, type AssignmentWithGrade } from '@/lib/coursework/courseworkUtils'

export const dynamic = 'force-dynamic'

function noCourseworkYet(message: string) {
  return (
    <div className="space-y-4">
      <div className="py-2">
        <h1 className="text-lg font-bold text-tranmere-blue">Coursework</h1>
      </div>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

export default async function ParentCourseworkPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: links } = await admin
    .from('parent_student_links')
    .select('student_id')
    .eq('parent_id', user.id)
  const studentId = links?.[0]?.student_id as string | undefined

  if (!studentId) {
    return noCourseworkYet('No linked student found.')
  }

  const { data: student } = await admin
    .from('users')
    .select('course_id')
    .eq('id', studentId)
    .maybeSingle()

  if (!student?.course_id) {
    return noCourseworkYet('No course assigned yet.')
  }

  const { data: units } = await admin
    .from('btec_units')
    .select('id, course_id, unit_number, unit_name')
    .eq('course_id', student.course_id)
    .order('unit_number')

  const unitIds = (units ?? []).map(u => u.id)

  const { data: assignments } = unitIds.length
    ? await admin
        .from('assignments')
        .select('id, unit_id, title, description, due_date, grade_target')
        .in('unit_id', unitIds)
    : { data: [] }

  const { data: grades } = await admin
    .from('assignment_grades')
    .select('assignment_id, grade')
    .eq('student_id', studentId)

  const gradeByAssignmentId = new Map((grades ?? []).map(g => [g.assignment_id, g.grade]))

  const assignmentsWithGrade: AssignmentWithGrade[] = (assignments ?? []).map(a => ({
    ...a,
    grade: (gradeByAssignmentId.get(a.id) ?? null) as AssignmentWithGrade['grade'],
  }))

  const groups = groupAssignmentsByUnit(assignmentsWithGrade, units ?? [])

  return (
    <div className="space-y-4">
      <div className="py-2">
        <h1 className="text-lg font-bold text-tranmere-blue">Coursework</h1>
        <p className="text-xs text-muted-foreground">Your child&apos;s BTEC assignments and results</p>
      </div>
      <CourseworkList groups={groups} />
    </div>
  )
}
```

- [ ] **Step 2: Add the nav link — `ParentSidebar.tsx`**

In `components/layout/ParentSidebar.tsx`, add `ClipboardCheck` to the import and insert an entry into the `nav` array (after Calendar, before Attendance):

```typescript
import { Home, ClipboardList, GraduationCap, Calendar, CalendarDays, MessageSquare, Megaphone, LogOut, FolderOpen, ClipboardCheck } from 'lucide-react'

const nav = [
  { href: '/parent/dashboard', label: 'Overview', icon: Home },
  { href: '/documents', label: 'Documents', icon: FolderOpen },
  { href: '/parent/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/parent/coursework', label: 'Coursework', icon: ClipboardCheck },
  { href: '/parent/attendance', label: 'Attendance', icon: ClipboardList },
  { href: MOODLE_STUDENT_URL, label: 'Moodle', icon: GraduationCap, external: true },
  { href: '/parent/matches', label: 'Matches', icon: Calendar },
  { href: '/parent/announcements', label: 'Announcements', icon: Megaphone },
  { href: '/parent/messages', label: 'Messages', icon: MessageSquare },
]
```

- [ ] **Step 3: Add the nav link — `MobileParentBar.tsx`**

In `components/layout/MobileParentBar.tsx`, same import/array change:

```typescript
import { Home, ClipboardList, GraduationCap, Calendar, CalendarDays, MessageSquare, Megaphone, FolderOpen, ClipboardCheck } from 'lucide-react'

const nav = [
  { href: '/parent/dashboard', label: 'Overview', icon: Home },
  { href: '/documents', label: 'Documents', icon: FolderOpen },
  { href: '/parent/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/parent/coursework', label: 'Coursework', icon: ClipboardCheck },
  { href: '/parent/attendance', label: 'Attendance', icon: ClipboardList },
  { href: MOODLE_STUDENT_URL, label: 'Moodle', icon: GraduationCap, external: true },
  { href: '/parent/announcements', label: 'News', icon: Megaphone },
  { href: '/parent/matches', label: 'Matches', icon: Calendar },
  { href: '/parent/messages', label: 'Messages', icon: MessageSquare },
]
```

- [ ] **Step 4: Verify — typecheck, lint, full test suite, build**

```bash
npx tsc --noEmit 2>&1 | grep -E "parent\)/parent/coursework|layout/ParentSidebar|layout/MobileParentBar"
npx eslint "app/(parent)/parent/coursework/page.tsx" "components/layout/ParentSidebar.tsx" "components/layout/MobileParentBar.tsx"
npm test -- --silent
npm run build
```

Expected: no output from the `tsc`/`grep` line, no eslint errors, full suite passes (74 + new suites, all green), build succeeds.

- [ ] **Step 5: Commit**

```bash
git add "app/(parent)/parent/coursework/page.tsx" components/layout/ParentSidebar.tsx components/layout/MobileParentBar.tsx
git commit -m "feat: add parent coursework page and nav link

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

## Final verification (after all 10 tasks)

- [ ] Run `npm test -- --silent` — expect all suites green, test count increased by the ~25 new tests added across Tasks 2–5 and 9.
- [ ] Run `npm run build` — expect success with `/admin/coursework`, `/coursework`, `/parent/coursework` listed among the routes.
- [ ] Spot-check live: use the Supabase MCP to confirm `assignment_grades` exists with the right RLS policies (query `pg_policies` filtered to `assignment_grades`).
- [ ] Push to `master` and confirm the deploy, following the same commit-test-push discipline used for the timetable and calendar-grid work earlier in this session.
