# Attendance Excusals (Ill / Appointment) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let staff record that a student is ill or at an appointment (whole day by default, narrowable to specific AM/Lunch/PM phases), so the Daily Attendance page shows an honest status instead of "Missing" or a faked "present" override, the missed-checkin and safeguarding alert crons stop pinging staff about a student they already know is away, and the weekly attendance % report treats it as authorised absence.

**Architecture:** One new `attendance_excusals` table (student_id, excused_date, reason, note, phases[], created_by), written via a new staff-only API route (`/api/attendance/excuse`, mirroring the existing `/api/attendance/manual-override` pattern), surfaced on the Daily Attendance page via two new small client components, and read (as an exclusion filter) by the two alert crons and the weekly report's percentage calculation.

**Tech Stack:** Next.js 14 App Router, Supabase (Postgres + RLS), Jest + Testing Library, Tailwind. Full context: [docs/superpowers/specs/2026-09-08-attendance-excusals-design.md](../specs/2026-09-08-attendance-excusals-design.md).

## Global Constraints

- Supabase project ref: `avpdwutgtsurddvfxhmh` (name: `tranmeretracker`)
- Staff role check uses the existing `requireStaff()` helper from `lib/auth/requireRole.ts` — do not write a new inline role-check
- Use `.maybeSingle()` for any Supabase lookup that may legitimately return no row — never `.single()`
- API routes and page/cron logic are **not** unit-tested, matching this codebase's existing convention. Interactive fetch-based components (`ExcuseButton`, `ExcusedPill`) are likewise not unit-tested — this matches the existing `OverrideButton.tsx`, which has zero test coverage despite the same fetch + `router.refresh()` pattern. Only `lib/attendance/excusal.ts` and the `lib/attendance/weeklyReport.ts` changes get Jest tests.
- All new/changed files must pass `npx next lint` and `npx tsc --noEmit -p .`
- Reuse `AttendancePhase` from `lib/attendance/phase.ts` for the `'am' | 'lunch' | 'pm'` type everywhere — never redeclare it
- This feature does not add any new cron route, so `vercel.json` is untouched
- Excused phases are authorised absence: excluded from missed-checkin/safeguarding alerts and excluded from both the numerator and denominator of the weekly attendance %

---

### Task 1: Database migration — `attendance_excusals` table + RLS

**Files:**
- Create: `supabase/migrations/062_attendance_excusals.sql`

**Interfaces:**
- Produces: table `attendance_excusals(id uuid, student_id uuid, excused_date date, reason text, note text nullable, phases text[], created_by uuid, created_at timestamptz)`, one row per student per day (`UNIQUE(student_id, excused_date)`), readable by staff and the student themself, writable only by staff.

- [ ] **Step 1: Write the migration file**

```sql
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

create policy "excusals_staff_all"
  on attendance_excusals for all
  using (
    exists (
      select 1 from public.users
      where id = auth.uid()
      and role in ('admin', 'coach', 'teacher')
    )
  );

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
```

- [ ] **Step 2: Apply the migration**

If Supabase MCP tools are available in this session, load them and apply directly:

```
ToolSearch: "select:mcp__d410daf9-4dcd-4083-8231-301c292286b1__apply_migration,mcp__d410daf9-4dcd-4083-8231-301c292286b1__execute_sql"
```

Then call `apply_migration` with `project_id: "avpdwutgtsurddvfxhmh"`, `name: "attendance_excusals"`, and `query` set to the full SQL from Step 1 (the `create table` / RLS statements — not the verification comments).

If Supabase MCP tools are not available, tell the user to run the file's contents in the Supabase Dashboard → SQL Editor for project `avpdwutgtsurddvfxhmh`.

- [ ] **Step 3: Verify**

Run the two verification queries from the end of the migration file via `execute_sql` (or the SQL Editor). Expected:
1. One row, `rowsecurity = true`
2. Two rows: `excusals_staff_all` (cmd `ALL`), `excusals_self_read` (cmd `SELECT`)

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/062_attendance_excusals.sql
git commit -m "feat: attendance_excusals table + RLS for ill/appointment tracking"
```

---

### Task 2: `lib/attendance/excusal.ts` — pure validation and helpers (TDD)

**Files:**
- Create: `lib/attendance/excusal.ts`
- Test: `__tests__/lib/attendance/excusal.test.ts`

**Interfaces:**
- Consumes: `AttendancePhase` from `lib/attendance/phase.ts`
- Produces:
  - `ExcusalReason = 'ill' | 'appointment' | 'other'`
  - `EXCUSAL_REASONS: readonly ExcusalReason[]`
  - `EXCUSAL_PHASES: readonly AttendancePhase[]` (`['am', 'lunch', 'pm']`)
  - `EXCUSAL_LABELS: Record<ExcusalReason, string>` (`{ ill: 'Ill', appointment: 'Appt', other: 'Other' }`)
  - `ExcuseRequest` union type (`'excuse' | 'clear' | 'clear_phase'` actions)
  - `isValidExcuseRequest(body): body is ExcuseRequest`
  - `resolvePhases(phases: AttendancePhase[] | undefined): AttendancePhase[]`
  - `buildExcusalRow(studentId, date, reason, note, phases, createdBy)`
  - `excusalCoversPhase(excusal: { phases: string[] } | null | undefined, phase: AttendancePhase): boolean`
  - `removePhase(phases: string[], phase: AttendancePhase): string[]`
  - `stripCheckedPhases(phases: AttendancePhase[], checked: { am: boolean; lunch: boolean; pm: boolean }): AttendancePhase[]`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/lib/attendance/excusal.test.ts`:

```ts
import {
  isValidExcuseRequest,
  resolvePhases,
  buildExcusalRow,
  excusalCoversPhase,
  removePhase,
  stripCheckedPhases,
  EXCUSAL_REASONS,
} from '@/lib/attendance/excusal'

describe('isValidExcuseRequest', () => {
  const base = { studentId: 'abc-123', date: '2026-09-08' }

  it('accepts a well-formed excuse request for each reason', () => {
    for (const reason of EXCUSAL_REASONS) {
      expect(isValidExcuseRequest({ ...base, action: 'excuse', reason })).toBe(true)
    }
  })

  it('accepts excuse with optional note and phases', () => {
    expect(isValidExcuseRequest({
      ...base, action: 'excuse', reason: 'appointment', note: 'Back for PM', phases: ['am'],
    })).toBe(true)
  })

  it('rejects excuse with an unknown reason', () => {
    expect(isValidExcuseRequest({ ...base, action: 'excuse', reason: 'holiday' })).toBe(false)
  })

  it('rejects excuse with an empty or unknown phases array', () => {
    expect(isValidExcuseRequest({ ...base, action: 'excuse', reason: 'ill', phases: [] })).toBe(false)
    expect(isValidExcuseRequest({ ...base, action: 'excuse', reason: 'ill', phases: ['evening'] })).toBe(false)
  })

  it('rejects excuse with a non-string note', () => {
    expect(isValidExcuseRequest({ ...base, action: 'excuse', reason: 'ill', note: 123 })).toBe(false)
  })

  it('accepts a clear request with no reason', () => {
    expect(isValidExcuseRequest({ ...base, action: 'clear' })).toBe(true)
  })

  it('accepts a clear_phase request with a valid phase', () => {
    expect(isValidExcuseRequest({ ...base, action: 'clear_phase', phase: 'lunch' })).toBe(true)
  })

  it('rejects a clear_phase request with an invalid phase', () => {
    expect(isValidExcuseRequest({ ...base, action: 'clear_phase', phase: 'evening' })).toBe(false)
  })

  it('rejects an unknown action', () => {
    expect(isValidExcuseRequest({ ...base, action: 'delete_everything' })).toBe(false)
  })

  it('rejects malformed dates and empty student ids', () => {
    expect(isValidExcuseRequest({ studentId: 'x', date: '08/09/2026', action: 'clear' })).toBe(false)
    expect(isValidExcuseRequest({ studentId: '', date: '2026-09-08', action: 'clear' })).toBe(false)
  })
})

describe('resolvePhases', () => {
  it('defaults to the whole day when phases is omitted', () => {
    expect(resolvePhases(undefined)).toEqual(['am', 'lunch', 'pm'])
  })

  it('defaults to the whole day when phases is empty', () => {
    expect(resolvePhases([])).toEqual(['am', 'lunch', 'pm'])
  })

  it('keeps a narrowed phases list as-is', () => {
    expect(resolvePhases(['am'])).toEqual(['am'])
  })
})

describe('buildExcusalRow', () => {
  it('builds a whole-day row when phases is omitted', () => {
    expect(buildExcusalRow('s1', '2026-09-08', 'ill', undefined, undefined, 'staff1')).toEqual({
      student_id: 's1',
      excused_date: '2026-09-08',
      reason: 'ill',
      note: null,
      phases: ['am', 'lunch', 'pm'],
      created_by: 'staff1',
    })
  })

  it('builds a narrowed row with a note', () => {
    expect(buildExcusalRow('s1', '2026-09-08', 'appointment', 'Dentist, back for PM', ['am'], 'staff1')).toEqual({
      student_id: 's1',
      excused_date: '2026-09-08',
      reason: 'appointment',
      note: 'Dentist, back for PM',
      phases: ['am'],
      created_by: 'staff1',
    })
  })
})

describe('excusalCoversPhase', () => {
  it('is true when phases includes the phase', () => {
    expect(excusalCoversPhase({ phases: ['am', 'lunch'] }, 'am')).toBe(true)
  })

  it('is false when phases does not include the phase', () => {
    expect(excusalCoversPhase({ phases: ['am'] }, 'pm')).toBe(false)
  })

  it('is false for null or undefined excusal', () => {
    expect(excusalCoversPhase(null, 'am')).toBe(false)
    expect(excusalCoversPhase(undefined, 'am')).toBe(false)
  })
})

describe('removePhase', () => {
  it('removes the given phase', () => {
    expect(removePhase(['am', 'lunch', 'pm'], 'lunch')).toEqual(['am', 'pm'])
  })

  it('returns an empty array when the last phase is removed', () => {
    expect(removePhase(['pm'], 'pm')).toEqual([])
  })

  it('is a no-op when the phase is not present', () => {
    expect(removePhase(['am'], 'pm')).toEqual(['am'])
  })
})

describe('stripCheckedPhases', () => {
  it('removes phases that already have a real check-in', () => {
    expect(stripCheckedPhases(['am', 'lunch', 'pm'], { am: true, lunch: false, pm: false })).toEqual(['lunch', 'pm'])
  })

  it('is a no-op when nothing is checked in', () => {
    expect(stripCheckedPhases(['am', 'lunch'], { am: false, lunch: false, pm: false })).toEqual(['am', 'lunch'])
  })

  it('can return an empty array when everything requested is already checked in', () => {
    expect(stripCheckedPhases(['am'], { am: true, lunch: false, pm: false })).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/lib/attendance/excusal.test.ts`
Expected: FAIL — `Cannot find module '@/lib/attendance/excusal'`

- [ ] **Step 3: Write the implementation**

Create `lib/attendance/excusal.ts`:

```ts
/**
 * Pure logic for the staff excusal endpoint (app/api/attendance/excuse) —
 * recording that a student is ill or at an appointment. Kept separate from
 * daily_attendance: "did they physically check in" (evidence: GPS, selfie,
 * NFC tap) stays distinct from "why weren't they expected in" (a staff
 * reason, no evidence attached). See
 * docs/superpowers/specs/2026-09-08-attendance-excusals-design.md
 */

import type { AttendancePhase } from '@/lib/attendance/phase'

export type ExcusalReason = 'ill' | 'appointment' | 'other'

export const EXCUSAL_REASONS: readonly ExcusalReason[] = ['ill', 'appointment', 'other'] as const
export const EXCUSAL_PHASES: readonly AttendancePhase[] = ['am', 'lunch', 'pm'] as const

/** Short labels used on both the reason picker and the per-phase pill. */
export const EXCUSAL_LABELS: Record<ExcusalReason, string> = {
  ill: 'Ill',
  appointment: 'Appt',
  other: 'Other',
}

export type ExcuseRequest =
  | { studentId: string; date: string; action: 'excuse'; reason: ExcusalReason; note?: string; phases?: AttendancePhase[] }
  | { studentId: string; date: string; action: 'clear' }
  | { studentId: string; date: string; action: 'clear_phase'; phase: AttendancePhase }

export function isValidExcuseRequest(body: {
  studentId?: unknown
  date?: unknown
  action?: unknown
  reason?: unknown
  note?: unknown
  phases?: unknown
  phase?: unknown
}): body is ExcuseRequest {
  const hasBaseFields =
    typeof body.studentId === 'string' && body.studentId.length > 0 &&
    typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
  if (!hasBaseFields) return false

  if (body.action === 'clear') return true

  if (body.action === 'clear_phase') {
    return EXCUSAL_PHASES.includes(body.phase as AttendancePhase)
  }

  if (body.action !== 'excuse') return false
  if (!EXCUSAL_REASONS.includes(body.reason as ExcusalReason)) return false
  if (body.note !== undefined && typeof body.note !== 'string') return false
  if (body.phases !== undefined) {
    if (!Array.isArray(body.phases) || body.phases.length === 0) return false
    if (!body.phases.every(p => EXCUSAL_PHASES.includes(p))) return false
  }
  return true
}

/** Defaults to the whole day when `phases` is omitted or empty — the common case (a sick day covers AM/Lunch/PM). */
export function resolvePhases(phases: AttendancePhase[] | undefined): AttendancePhase[] {
  return phases && phases.length > 0 ? phases : [...EXCUSAL_PHASES]
}

/** Row to upsert into attendance_excusals for an 'excuse' request. */
export function buildExcusalRow(
  studentId: string,
  date: string,
  reason: ExcusalReason,
  note: string | undefined,
  phases: AttendancePhase[] | undefined,
  createdBy: string,
) {
  return {
    student_id: studentId,
    excused_date: date,
    reason,
    note: note ?? null,
    phases: resolvePhases(phases),
    created_by: createdBy,
  }
}

/** Does an excusal's phases[] cover the given phase? A null/undefined excusal covers nothing. */
export function excusalCoversPhase(
  excusal: { phases: string[] } | null | undefined,
  phase: AttendancePhase,
): boolean {
  return excusal?.phases.includes(phase) ?? false
}

/** Phases list with one phase removed — used by the 'clear_phase' action to narrow coverage. */
export function removePhase(phases: string[], phase: AttendancePhase): string[] {
  return phases.filter(p => p !== phase)
}

/**
 * Drops any phase that already has a real check-in. An excusal covering a
 * phase the student already tapped in for would be a no-op that corrupts the
 * weekly % (the day would count as both checked AND excused, shrinking its
 * denominator below its numerator). Called by the 'excuse' action before
 * writing the row.
 */
export function stripCheckedPhases(
  phases: AttendancePhase[],
  checked: { am: boolean; lunch: boolean; pm: boolean },
): AttendancePhase[] {
  return phases.filter(p => !checked[p])
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/lib/attendance/excusal.test.ts`
Expected: PASS, all tests green

- [ ] **Step 5: Commit**

```bash
git add lib/attendance/excusal.ts __tests__/lib/attendance/excusal.test.ts
git commit -m "feat: attendance excusal validation and helper logic"
```

---

### Task 3: API route — `app/api/attendance/excuse`

**Files:**
- Create: `app/api/attendance/excuse/route.ts`

**Interfaces:**
- Consumes: `requireStaff` from `lib/auth/requireRole.ts`; `isValidExcuseRequest`, `buildExcusalRow`, `removePhase`, `resolvePhases`, `stripCheckedPhases` from `lib/attendance/excusal.ts`
- Produces: `POST /api/attendance/excuse` — body `{ studentId, date, action: 'excuse', reason, note?, phases? } | { studentId, date, action: 'clear' } | { studentId, date, action: 'clear_phase', phase }`. Returns `{ ok: true, ... }` on success, or `409` if every requested phase for an 'excuse' is already checked in.

- [ ] **Step 1: Write the route**

Create `app/api/attendance/excuse/route.ts`:

```ts
// Staff action for recording a known reason a student isn't expected in
// (parent called/emailed: ill or at an appointment). Replaces the dishonest
// "mark present" workaround (OverrideButton) for this case, and is read by
// the missed-checkin-sweep / attendance-safeguarding-check crons and the
// weekly report to suppress alerts and exclude authorised absence from the
// attendance %. See docs/superpowers/specs/2026-09-08-attendance-excusals-design.md

import { requireStaff } from '@/lib/auth/requireRole'
import { isValidExcuseRequest, buildExcusalRow, removePhase, resolvePhases, stripCheckedPhases } from '@/lib/attendance/excusal'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const auth = await requireStaff()
  if (!auth.ok) return auth.response
  const { user, admin } = auth.ctx

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (typeof body !== 'object' || body === null || !isValidExcuseRequest(body)) {
    return NextResponse.json(
      { error: 'Expected { studentId, date: YYYY-MM-DD, action: excuse|clear|clear_phase, reason?: ill|appointment|other, note?, phases?, phase? }' },
      { status: 400 },
    )
  }

  const { studentId, date, action } = body

  const { data: student } = await admin
    .from('users')
    .select('id, role')
    .eq('id', studentId)
    .maybeSingle()
  if (!student || student.role !== 'student') {
    return NextResponse.json({ error: 'Student not found' }, { status: 404 })
  }

  if (action === 'clear') {
    const { error } = await admin
      .from('attendance_excusals')
      .delete()
      .eq('student_id', studentId)
      .eq('excused_date', date)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, action })
  }

  if (action === 'clear_phase') {
    const { data: existing } = await admin
      .from('attendance_excusals')
      .select('phases')
      .eq('student_id', studentId)
      .eq('excused_date', date)
      .maybeSingle()
    if (!existing) return NextResponse.json({ ok: true, action, phases: [] })

    const remaining = removePhase(existing.phases, body.phase)
    if (remaining.length === 0) {
      const { error } = await admin
        .from('attendance_excusals')
        .delete()
        .eq('student_id', studentId)
        .eq('excused_date', date)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      const { error } = await admin
        .from('attendance_excusals')
        .update({ phases: remaining })
        .eq('student_id', studentId)
        .eq('excused_date', date)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, action, phases: remaining })
  }

  // action === 'excuse' — drop any requested phase that already has a real
  // check-in, so an excusal can never claim a phase the student actually
  // attended (see stripCheckedPhases).
  const { data: existingAttendance } = await admin
    .from('daily_attendance')
    .select('am_checked_at, lunch_checked_at, pm_checked_at')
    .eq('student_id', studentId)
    .eq('attendance_date', date)
    .maybeSingle()

  const requestedPhases = resolvePhases(body.phases)
  const phases = stripCheckedPhases(requestedPhases, {
    am: existingAttendance?.am_checked_at != null,
    lunch: existingAttendance?.lunch_checked_at != null,
    pm: existingAttendance?.pm_checked_at != null,
  })

  if (phases.length === 0) {
    return NextResponse.json(
      { error: 'This student is already checked in for every requested phase — nothing to excuse.' },
      { status: 409 },
    )
  }

  const row = buildExcusalRow(studentId, date, body.reason, body.note, phases, user.id)
  const { error } = await admin
    .from('attendance_excusals')
    .upsert(row, { onConflict: 'student_id,excused_date' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, action, reason: body.reason, phases: row.phases })
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p .`
Expected: no new errors from this file

- [ ] **Step 3: Commit**

```bash
git add app/api/attendance/excuse/route.ts
git commit -m "feat: /api/attendance/excuse route for ill/appointment excusals"
```

---

### Task 4: `ExcuseButton` and `ExcusedPill` components

**Files:**
- Create: `app/(admin)/admin/attendance/ExcuseButton.tsx`
- Create: `app/(admin)/admin/attendance/ExcusedPill.tsx`

**Interfaces:**
- Consumes: `ExcusalReason`, `EXCUSAL_LABELS` from `lib/attendance/excusal.ts`; `AttendancePhase` from `lib/attendance/phase.ts`
- Produces:
  - `ExcuseButton({ studentId, date, excusal }: { studentId: string; date: string; excusal: { reason: ExcusalReason; note: string | null } | null })` — row-level control: "Excuse" button (opens a reason picker) when no excusal exists, or a status pill with "Undo" (clears the whole excusal) when one does.
  - `ExcusedPill({ studentId, date, phase, reason, note }: { studentId: string; date: string; phase: AttendancePhase; reason: ExcusalReason; note: string | null })` — per-phase-cell pill shown instead of the blank/Mark control when that phase is covered by an excusal, with an "undo" that narrows coverage (removes just this phase).

- [ ] **Step 1: Write `ExcuseButton.tsx`**

```tsx
'use client'

// Row-level staff control: records a known reason a student isn't expected
// in (ill / appointment / other), whole day by default. See ExcusedPill for
// the per-phase narrowing control shown on individual AM/Lunch/PM cells.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { EXCUSAL_LABELS, EXCUSAL_REASONS, type ExcusalReason } from '@/lib/attendance/excusal'

export function ExcuseButton({
  studentId,
  date,
  excusal,
}: {
  studentId: string
  date: string
  excusal: { reason: ExcusalReason; note: string | null } | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [busy, setBusy] = useState(false)
  const [picking, setPicking] = useState(false)
  const [error, setError] = useState(false)

  const submit = async (body: Record<string, unknown>) => {
    setBusy(true)
    setError(false)
    try {
      const res = await fetch('/api/attendance/excuse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, date, ...body }),
      })
      if (!res.ok) throw new Error()
      setPicking(false)
      startTransition(() => router.refresh())
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  const excuse = (reason: ExcusalReason) => {
    const note = window.prompt(`Optional note (e.g. "back for PM"):`)?.trim()
    submit({ action: 'excuse', reason, note: note || undefined })
  }

  const undo = () => {
    if (!window.confirm('Clear this excusal? Any uncovered phases will go back to "missing".')) return
    submit({ action: 'clear' })
  }

  if (excusal) {
    return (
      <button
        type="button"
        onClick={undo}
        disabled={busy || pending}
        title={excusal.note ?? EXCUSAL_LABELS[excusal.reason]}
        className="text-[10px] font-semibold px-1.5 py-0.5 rounded border border-gray-200 text-muted-foreground hover:bg-gray-100 disabled:opacity-40 shrink-0"
      >
        {busy || pending ? '…' : `${EXCUSAL_LABELS[excusal.reason]} · Undo`}
      </button>
    )
  }

  if (picking) {
    return (
      <span className="flex items-center gap-1 shrink-0">
        {EXCUSAL_REASONS.map(r => (
          <button
            key={r}
            type="button"
            onClick={() => excuse(r)}
            disabled={busy}
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded border border-tranmere-blue/30 text-tranmere-blue hover:bg-tranmere-blue/10 disabled:opacity-40"
          >
            {EXCUSAL_LABELS[r]}
          </button>
        ))}
        <button type="button" onClick={() => setPicking(false)} className="text-[10px] text-muted-foreground px-1">✕</button>
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setPicking(true)}
      title="Record a known reason (ill / appointment) — suppresses missing-checkin alerts for the day"
      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0 transition-colors ${
        error ? 'border-red-300 text-red-600 bg-red-50' : 'border-gray-200 text-muted-foreground hover:bg-gray-100'
      }`}
    >
      {error ? 'Retry' : 'Excuse'}
    </button>
  )
}
```

- [ ] **Step 2: Write `ExcusedPill.tsx`**

```tsx
'use client'

// Per-phase-cell control: shown instead of the blank "—"/Mark control when
// this phase is covered by an active excusal. "undo" narrows coverage
// (removes just this phase) rather than clearing the whole excusal — see
// ExcuseButton for the row-level full-clear control.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { EXCUSAL_LABELS, type ExcusalReason } from '@/lib/attendance/excusal'
import type { AttendancePhase } from '@/lib/attendance/phase'

export function ExcusedPill({
  studentId, date, phase, reason, note,
}: {
  studentId: string
  date: string
  phase: AttendancePhase
  reason: ExcusalReason
  note: string | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [busy, setBusy] = useState(false)

  const clearPhase = async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/attendance/excuse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, date, action: 'clear_phase', phase }),
      })
      if (res.ok) startTransition(() => router.refresh())
    } finally {
      setBusy(false)
    }
  }

  return (
    <span
      title={note ?? EXCUSAL_LABELS[reason]}
      className="flex items-center justify-center gap-1 text-xs font-medium text-gray-500"
    >
      {EXCUSAL_LABELS[reason]}
      <button
        type="button"
        onClick={clearPhase}
        disabled={busy || pending}
        className="text-[10px] underline decoration-dotted disabled:opacity-40"
      >
        {busy || pending ? '…' : 'undo'}
      </button>
    </span>
  )
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit -p .`
Expected: no new errors from these two files

- [ ] **Step 4: Commit**

```bash
git add "app/(admin)/admin/attendance/ExcuseButton.tsx" "app/(admin)/admin/attendance/ExcusedPill.tsx"
git commit -m "feat: ExcuseButton and ExcusedPill components for the attendance page"
```

---

### Task 5: Wire excusals into the Daily Attendance page

**Files:**
- Modify: `app/(admin)/admin/attendance/page.tsx`

**Interfaces:**
- Consumes: `excusalCoversPhase` from `lib/attendance/excusal.ts`; `ExcuseButton` (Task 4); `ExcusedPill` (Task 4)

- [ ] **Step 1: Fetch excusals alongside the existing queries**

In `app/(admin)/admin/attendance/page.tsx`, add the import and extend the parallel query (around line 49-55):

```ts
import { excusalCoversPhase } from '@/lib/attendance/excusal'
import { ExcuseButton } from './ExcuseButton'
import { ExcusedPill } from './ExcusedPill'
```

Replace:

```ts
  // Roster + records in parallel
  const [{ data: students }, { data: records }] = await Promise.all([
    admin.from('users').select('id, name, avatar_url').eq('role', 'student').order('name'),
    admin
      .from('daily_attendance')
      .select('student_id, am_checked_at, lunch_checked_at, pm_checked_at, am_is_flagged, lunch_is_flagged, pm_is_flagged, am_flag_reason, lunch_flag_reason, pm_flag_reason, am_selfie_path, pm_selfie_path')
      .eq('attendance_date', date),
  ])

  const recMap = new Map((records ?? []).map(r => [r.student_id, r]))
```

with:

```ts
  // Roster + records + excusals in parallel
  const [{ data: students }, { data: records }, { data: excusals }] = await Promise.all([
    admin.from('users').select('id, name, avatar_url').eq('role', 'student').order('name'),
    admin
      .from('daily_attendance')
      .select('student_id, am_checked_at, lunch_checked_at, pm_checked_at, am_is_flagged, lunch_is_flagged, pm_is_flagged, am_flag_reason, lunch_flag_reason, pm_flag_reason, am_selfie_path, pm_selfie_path')
      .eq('attendance_date', date),
    admin
      .from('attendance_excusals')
      .select('student_id, reason, note, phases')
      .eq('excused_date', date),
  ])

  const recMap = new Map((records ?? []).map(r => [r.student_id, r]))
  const excusalMap = new Map((excusals ?? []).map(e => [e.student_id, e]))
```

- [ ] **Step 2: Carry the excusal onto each row**

Extend `StudentRow` (around line 59-72) — add one field:

```ts
  type StudentRow = {
    id: string
    name: string
    avatar_url: string | null
    am: string | null
    lunch: string | null
    pm: string | null
    am_flagged: boolean
    lunch_flagged: boolean
    pm_flagged: boolean
    am_reason: string | null
    lunch_reason: string | null
    pm_reason: string | null
    excusal: { reason: 'ill' | 'appointment' | 'other'; note: string | null; phases: string[] } | null
  }
```

Extend the `rows` mapping (around line 74-90) to attach it:

```ts
  const rows: StudentRow[] = (students ?? []).map(s => {
    const r = recMap.get(s.id)
    const e = excusalMap.get(s.id)
    return {
      id: s.id,
      name: s.name,
      avatar_url: s.avatar_url,
      am: r?.am_checked_at ?? null,
      lunch: r?.lunch_checked_at ?? null,
      pm: r?.pm_checked_at ?? null,
      am_flagged: r?.am_is_flagged ?? false,
      lunch_flagged: r?.lunch_is_flagged ?? false,
      pm_flagged: r?.pm_is_flagged ?? false,
      am_reason: r?.am_flag_reason ?? null,
      lunch_reason: r?.lunch_flag_reason ?? null,
      pm_reason: r?.pm_flag_reason ?? null,
      excusal: e ? { reason: e.reason, note: e.note, phases: e.phases } : null,
    }
  })
```

- [ ] **Step 3: Exclude excused phases from Missing counts and the sort**

Replace the summary calculations (around line 92-98):

```ts
  const amIn       = rows.filter(r => r.am).length
  const lunchIn    = rows.filter(r => r.lunch).length
  const pmOut      = rows.filter(r => r.pm).length
  const amMissing    = rows.length - amIn
  const lunchMissing = rows.length - lunchIn
  const pmMissing    = rows.length - pmOut
  const flagged    = rows.filter(r => r.am_flagged || r.lunch_flagged || r.pm_flagged).length
```

with:

```ts
  const amIn       = rows.filter(r => r.am).length
  const lunchIn    = rows.filter(r => r.lunch).length
  const pmOut      = rows.filter(r => r.pm).length
  const amMissing    = rows.filter(r => !r.am && !excusalCoversPhase(r.excusal, 'am')).length
  const lunchMissing = rows.filter(r => !r.lunch && !excusalCoversPhase(r.excusal, 'lunch')).length
  const pmMissing    = rows.filter(r => !r.pm && !excusalCoversPhase(r.excusal, 'pm')).length
  const flagged    = rows.filter(r => r.am_flagged || r.lunch_flagged || r.pm_flagged).length
  const excused    = rows.filter(r => r.excusal).length
```

Replace the sort (around line 100-106):

```ts
  // Sort: missing first, then by name
  rows.sort((a, b) => {
    const aMissing = !a.am || !a.lunch || !a.pm
    const bMissing = !b.am || !b.lunch || !b.pm
    if (aMissing !== bMissing) return aMissing ? -1 : 1
    return a.name.localeCompare(b.name)
  })
```

with:

```ts
  // Sort: genuinely missing (not checked in AND not excused for that phase) first, then by name
  const isGenuinelyMissing = (r: StudentRow) =>
    (!r.am && !excusalCoversPhase(r.excusal, 'am')) ||
    (!r.lunch && !excusalCoversPhase(r.excusal, 'lunch')) ||
    (!r.pm && !excusalCoversPhase(r.excusal, 'pm'))
  rows.sort((a, b) => {
    const aMissing = isGenuinelyMissing(a)
    const bMissing = isGenuinelyMissing(b)
    if (aMissing !== bMissing) return aMissing ? -1 : 1
    return a.name.localeCompare(b.name)
  })
```

- [ ] **Step 4: Add the Excused summary tile**

Replace the summary tiles grid (around line 153-159):

```tsx
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        <SummaryTile icon={<Sun size={14} />}             label="AM In"   value={`${amIn}/${rows.length}`} tone="blue" />
        <SummaryTile icon={<UtensilsCrossed size={14} />} label="Lunch"   value={`${lunchIn}/${rows.length}`} tone="green" />
        <SummaryTile icon={<Moon size={14} />}            label="PM Out"  value={`${pmOut}/${rows.length}`} tone="purple" />
        <SummaryTile icon={<UserX size={14} />}           label="Missing" value={`${Math.max(amMissing, lunchMissing, pmMissing)}`} tone={Math.max(amMissing, lunchMissing, pmMissing) > 0 ? 'red' : 'gray'} />
        <SummaryTile icon={<AlertTriangle size={14} />}   label="Flagged" value={`${flagged}`} tone={flagged > 0 ? 'amber' : 'gray'} />
      </div>
```

with:

```tsx
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
        <SummaryTile icon={<Sun size={14} />}             label="AM In"   value={`${amIn}/${rows.length}`} tone="blue" />
        <SummaryTile icon={<UtensilsCrossed size={14} />} label="Lunch"   value={`${lunchIn}/${rows.length}`} tone="green" />
        <SummaryTile icon={<Moon size={14} />}            label="PM Out"  value={`${pmOut}/${rows.length}`} tone="purple" />
        <SummaryTile icon={<UserX size={14} />}           label="Missing" value={`${Math.max(amMissing, lunchMissing, pmMissing)}`} tone={Math.max(amMissing, lunchMissing, pmMissing) > 0 ? 'red' : 'gray'} />
        <SummaryTile icon={<CalendarOff size={14} />}     label="Excused" value={`${excused}`} tone="gray" />
        <SummaryTile icon={<AlertTriangle size={14} />}   label="Flagged" value={`${flagged}`} tone={flagged > 0 ? 'amber' : 'gray'} />
      </div>
```

Add `CalendarOff` to the `lucide-react` import at the top of the file (line 6-10):

```ts
import {
  ClipboardList, ChevronLeft, ChevronRight,
  CheckCircle2, AlertTriangle, UserX, Sun, Moon, ArrowRightCircle,
  Printer, Download, Settings, UtensilsCrossed, FileText, CalendarOff,
} from 'lucide-react'
```

- [ ] **Step 5: Show `ExcuseButton` in the name cell and pass excusal state to `PhaseCell`**

Replace the row's name cell and `PhaseCell` calls (around line 179-191):

```tsx
                <div className="flex items-center gap-2.5 min-w-0">
                  {r.avatar_url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={r.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                    : <div className="w-7 h-7 rounded-full bg-tranmere-blue/10 flex items-center justify-center text-tranmere-blue text-[10px] font-bold shrink-0">
                        {r.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                  }
                  <span className="font-medium truncate">{r.name}</span>
                </div>
                <PhaseCell time={r.am}    flagged={r.am_flagged}    reason={r.am_reason}    studentId={r.id} date={date} phase="am" />
                <PhaseCell time={r.lunch} flagged={r.lunch_flagged} reason={r.lunch_reason} studentId={r.id} date={date} phase="lunch" />
                <PhaseCell time={r.pm}    flagged={r.pm_flagged}    reason={r.pm_reason}    studentId={r.id} date={date} phase="pm" />
```

with:

```tsx
                <div className="flex items-center gap-2.5 min-w-0">
                  {r.avatar_url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={r.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                    : <div className="w-7 h-7 rounded-full bg-tranmere-blue/10 flex items-center justify-center text-tranmere-blue text-[10px] font-bold shrink-0">
                        {r.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                  }
                  <span className="font-medium truncate">{r.name}</span>
                  <ExcuseButton studentId={r.id} date={date} excusal={r.excusal ? { reason: r.excusal.reason, note: r.excusal.note } : null} />
                </div>
                <PhaseCell time={r.am}    flagged={r.am_flagged}    reason={r.am_reason}    studentId={r.id} date={date} phase="am"    excusal={r.excusal} />
                <PhaseCell time={r.lunch} flagged={r.lunch_flagged} reason={r.lunch_reason} studentId={r.id} date={date} phase="lunch" excusal={r.excusal} />
                <PhaseCell time={r.pm}    flagged={r.pm_flagged}    reason={r.pm_reason}    studentId={r.id} date={date} phase="pm"    excusal={r.excusal} />
```

- [ ] **Step 6: Extend `PhaseCell` to render the excused pill**

Replace the `PhaseCell` function (around line 276-306):

```tsx
function PhaseCell({
  time, flagged, reason, studentId, date, phase,
}: {
  time: string | null
  flagged: boolean
  reason: string | null
  studentId: string
  date: string
  phase: 'am' | 'lunch' | 'pm'
}) {
  if (!time) {
    return (
      <span className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <span aria-label="Missing">—</span>
        <OverrideButton studentId={studentId} date={date} phase={phase} present={false} />
      </span>
    )
  }
  return (
    <span className="flex items-center justify-center gap-1 text-xs font-medium text-green-700">
      <CheckCircle2 size={13} className="text-green-500" />
      {fmtTime(time)}
      {flagged && (
        <span title={reason ?? 'Flagged'} className="ml-0.5">
          <AlertTriangle size={11} className="text-amber-500" />
        </span>
      )}
      <OverrideButton studentId={studentId} date={date} phase={phase} present={true} />
    </span>
  )
}
```

with:

```tsx
function PhaseCell({
  time, flagged, reason, studentId, date, phase, excusal,
}: {
  time: string | null
  flagged: boolean
  reason: string | null
  studentId: string
  date: string
  phase: 'am' | 'lunch' | 'pm'
  excusal: { reason: 'ill' | 'appointment' | 'other'; note: string | null; phases: string[] } | null
}) {
  if (!time && excusalCoversPhase(excusal, phase)) {
    return (
      <ExcusedPill
        studentId={studentId}
        date={date}
        phase={phase}
        reason={excusal!.reason}
        note={excusal!.note}
      />
    )
  }
  if (!time) {
    return (
      <span className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <span aria-label="Missing">—</span>
        <OverrideButton studentId={studentId} date={date} phase={phase} present={false} />
      </span>
    )
  }
  return (
    <span className="flex items-center justify-center gap-1 text-xs font-medium text-green-700">
      <CheckCircle2 size={13} className="text-green-500" />
      {fmtTime(time)}
      {flagged && (
        <span title={reason ?? 'Flagged'} className="ml-0.5">
          <AlertTriangle size={11} className="text-amber-500" />
        </span>
      )}
      <OverrideButton studentId={studentId} date={date} phase={phase} present={true} />
    </span>
  )
}
```

- [ ] **Step 7: Verify it compiles**

Run: `npx tsc --noEmit -p .`
Expected: no new errors from `page.tsx`

- [ ] **Step 8: Commit**

```bash
git add "app/(admin)/admin/attendance/page.tsx"
git commit -m "feat: wire ill/appointment excusals into the Daily Attendance page"
```

---

### Task 6: Suppress `missed-checkin-sweep` alerts for excused phases

**Files:**
- Modify: `app/api/cron/missed-checkin-sweep/route.ts:71-82`

**Interfaces:**
- Consumes: `excusalCoversPhase` from `lib/attendance/excusal.ts`

- [ ] **Step 1: Add the import**

At the top of `app/api/cron/missed-checkin-sweep/route.ts`, add:

```ts
import { excusalCoversPhase } from '@/lib/attendance/excusal'
```

- [ ] **Step 2: Fetch excusals and exclude covered students from `missing`**

Replace:

```ts
    const [{ data: students }, { data: rows }] = await Promise.all([
      admin.from('users').select('id, name').eq('role', 'student').eq('is_active', true),
      admin.from('daily_attendance').select(`student_id, ${phase}_checked_at`).eq('attendance_date', today),
    ])

    const checkedField = `${phase}_checked_at` as const
    const checkedIds = new Set(
      (rows ?? [])
        .filter(r => (r as Record<string, unknown>)[checkedField] !== null)
        .map(r => (r as { student_id: string }).student_id)
    )
    const missing = (students ?? []).filter(s => !checkedIds.has(s.id))
```

with:

```ts
    const [{ data: students }, { data: rows }, { data: excusals }] = await Promise.all([
      admin.from('users').select('id, name').eq('role', 'student').eq('is_active', true),
      admin.from('daily_attendance').select(`student_id, ${phase}_checked_at`).eq('attendance_date', today),
      admin.from('attendance_excusals').select('student_id, phases').eq('excused_date', today),
    ])

    const checkedField = `${phase}_checked_at` as const
    const checkedIds = new Set(
      (rows ?? [])
        .filter(r => (r as Record<string, unknown>)[checkedField] !== null)
        .map(r => (r as { student_id: string }).student_id)
    )
    const excusalByStudent = new Map((excusals ?? []).map(e => [e.student_id, e]))
    const missing = (students ?? []).filter(
      s => !checkedIds.has(s.id) && !excusalCoversPhase(excusalByStudent.get(s.id), phase)
    )
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit -p .`
Expected: no new errors from this file

- [ ] **Step 4: Commit**

```bash
git add app/api/cron/missed-checkin-sweep/route.ts
git commit -m "fix: missed-checkin-sweep excludes phases covered by an excusal"
```

---

### Task 7: Suppress `attendance-safeguarding-check` alerts for excused phases

**Files:**
- Modify: `app/api/cron/attendance-safeguarding-check/route.ts:55-69`

**Interfaces:**
- Consumes: `excusalCoversPhase` from `lib/attendance/excusal.ts`

- [ ] **Step 1: Add the import**

At the top of `app/api/cron/attendance-safeguarding-check/route.ts`, add:

```ts
import { excusalCoversPhase } from '@/lib/attendance/excusal'
```

- [ ] **Step 2: Fetch excusals and exclude students excused for lunch/PM from `atRisk`**

This cron's "at risk" case is specifically a student checked in for AM who then goes quiet for both lunch and PM (see the file's header comment) — the relevant exclusion is an excusal covering `lunch` (a morning appointment, sent home ill after AM, etc. — staff already know why the student isn't at lunch or PM). Replace:

```ts
  const [{ data: students }, { data: rows }] = await Promise.all([
    admin.from('users').select('id, name').eq('role', 'student').eq('is_active', true),
    admin
      .from('daily_attendance')
      .select('student_id, am_checked_at, lunch_checked_at, pm_checked_at')
      .eq('attendance_date', today),
  ])

  const rowByStudent = new Map((rows ?? []).map(r => [r.student_id, r]))

  // Was here this morning, then went quiet for both lunch and the afternoon.
  const atRisk = (students ?? []).filter(s => {
    const row = rowByStudent.get(s.id)
    return row?.am_checked_at != null && row.lunch_checked_at == null && row.pm_checked_at == null
  })
```

with:

```ts
  const [{ data: students }, { data: rows }, { data: excusals }] = await Promise.all([
    admin.from('users').select('id, name').eq('role', 'student').eq('is_active', true),
    admin
      .from('daily_attendance')
      .select('student_id, am_checked_at, lunch_checked_at, pm_checked_at')
      .eq('attendance_date', today),
    admin.from('attendance_excusals').select('student_id, phases').eq('excused_date', today),
  ])

  const rowByStudent = new Map((rows ?? []).map(r => [r.student_id, r]))
  const excusalByStudent = new Map((excusals ?? []).map(e => [e.student_id, e]))

  // Was here this morning, then went quiet for both lunch and the afternoon —
  // unless staff already logged a known reason (e.g. sent home ill after AM,
  // an afternoon appointment) covering lunch.
  const atRisk = (students ?? []).filter(s => {
    const row = rowByStudent.get(s.id)
    if (row?.am_checked_at == null || row.lunch_checked_at != null || row.pm_checked_at != null) return false
    return !excusalCoversPhase(excusalByStudent.get(s.id), 'lunch')
  })
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit -p .`
Expected: no new errors from this file

- [ ] **Step 4: Commit**

```bash
git add app/api/cron/attendance-safeguarding-check/route.ts
git commit -m "fix: attendance-safeguarding-check excludes students excused for lunch"
```

---

### Task 8: Exclude excused phases from the weekly attendance % (TDD)

**Files:**
- Modify: `lib/attendance/weeklyReport.ts`
- Test: `__tests__/lib/attendance/weeklyReport.test.ts`

**Interfaces:**
- Produces: `computeWeeklyAttendance` gains a 5th parameter `excusalsByStudentDate: Map<string, string[]>` (key: `` `${studentId}|${dateISO}` ``, value: the `phases` array), defaulting to `new Map()` so every existing 4-arg call site keeps working. `DayCell` gains `excusedCount: number`.

- [ ] **Step 1: Write the failing tests**

Add to `__tests__/lib/attendance/weeklyReport.test.ts`, inside the `describe('computeWeeklyAttendance', ...)` block (after the last existing `it(...)`, before its closing `})`):

```ts
  it('excludes an excused phase from both the numerator and denominator', () => {
    // Alice checks in AM+lunch every day but is excused for PM (appointment) on Monday only.
    const records = weekDates.map(d => rec({
      student_id: 's1', attendance_date: d,
      am_checked_at: 'x', lunch_checked_at: 'x', // no pm
    }))
    const excusals = new Map([[`s1|${weekDates[0]}`, ['pm']]])
    const { rows } = computeWeeklyAttendance(students, records, weekDates, today, excusals)
    const alice = rows.find(r => r.id === 's1')!
    // Mon: 2 checked / 2 possible (pm excused). Tue-Fri: 2 checked / 3 possible each.
    // (2 + 2*4) / (2 + 3*4) = 10/14 = 71%
    expect(alice.weekPct).toBe(71)
    expect(alice.days[0].excusedCount).toBe(1)
    expect(alice.days[1].excusedCount).toBe(0)
  })

  it('gives a student excused for the whole week a null % (no possible slots left), not a punishing 0%', () => {
    // Bob is off ill all week (checks in nothing, every phase excused every day).
    const excusals = new Map(weekDates.map(d => [`s2|${d}`, ['am', 'lunch', 'pm']]))
    const { rows } = computeWeeklyAttendance(students, [], weekDates, today, excusals)
    const bob = rows.find(r => r.id === 's2')!
    expect(bob.weekPct).toBeNull()
    expect(bob.days.every(d => d.excusedCount === 3)).toBe(true)
  })

  it('defaults to no excusals when the 5th argument is omitted', () => {
    const { rows } = computeWeeklyAttendance(students, [], weekDates, today)
    expect(rows.find(r => r.id === 's1')!.days.every(d => d.excusedCount === 0)).toBe(true)
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/lib/attendance/weeklyReport.test.ts`
Expected: FAIL — `computeWeeklyAttendance` doesn't accept a 5th argument / `excusedCount` is undefined

- [ ] **Step 3: Update the implementation**

In `lib/attendance/weeklyReport.ts`, update the types and function:

```ts
export type DayCell = { dateISO: string; isFuture: boolean; checkedCount: number; excusedCount: number }
```

Replace the `computeWeeklyAttendance` signature and body:

```ts
export function computeWeeklyAttendance(
  students: Student[],
  records: AttendanceRecord[],
  weekDates: string[],
  todayISO: string,
  excusalsByStudentDate: Map<string, string[]> = new Map(),
): WeeklyAttendanceSummary {
  const byStudent = new Map<string, Map<string, AttendanceRecord>>()
  for (const r of records) {
    if (!byStudent.has(r.student_id)) byStudent.set(r.student_id, new Map())
    byStudent.get(r.student_id)!.set(r.attendance_date, r)
  }

  const flagNotes: FlagNote[] = []

  const rows: StudentWeekRow[] = students.map(s => {
    const recByDate = byStudent.get(s.id)
    let weeklyChecked = 0
    let weeklyPossible = 0

    const days: DayCell[] = weekDates.map(dateISO => {
      const isFuture = dateISO > todayISO
      const r = recByDate?.get(dateISO)
      const checkedCount = r ? PHASES.filter(p => r[`${p}_checked_at` as const]).length : 0
      const excusedPhases = excusalsByStudentDate.get(`${s.id}|${dateISO}`) ?? []
      const excusedCount = PHASES.filter(p => excusedPhases.includes(p)).length

      if (!isFuture) {
        weeklyChecked += checkedCount
        weeklyPossible += 3 - excusedCount
      }
      if (r) {
        for (const p of PHASES) {
          if (r[`${p}_is_flagged` as const]) {
            flagNotes.push({
              name: s.name,
              dateISO,
              phase: p.toUpperCase(),
              reason: r[`${p}_flag_reason` as const] ?? '—',
            })
          }
        }
      }
      return { dateISO, isFuture, checkedCount, excusedCount }
    })

    const weekPct = weeklyPossible > 0 ? Math.round((weeklyChecked / weeklyPossible) * 100) : null
    return { id: s.id, name: s.name, days, weekPct }
  })

  const withData = rows.filter(r => r.weekPct !== null)
  const cohortAvgPct = withData.length > 0
    ? Math.round(withData.reduce((sum, r) => sum + (r.weekPct ?? 0), 0) / withData.length)
    : null
  const belowThreshold = withData.filter(r => (r.weekPct ?? 100) < BELOW_THRESHOLD_PCT)

  return { rows, cohortAvgPct, belowThreshold, flagNotes }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/lib/attendance/weeklyReport.test.ts`
Expected: PASS, all tests green (existing + 3 new)

- [ ] **Step 5: Commit**

```bash
git add lib/attendance/weeklyReport.ts __tests__/lib/attendance/weeklyReport.test.ts
git commit -m "feat: weekly attendance % excludes excused phases (authorised absence)"
```

---

### Task 9: Wire excusals into the weekly print report page

**Files:**
- Modify: `app/(admin)/admin/attendance/print/week/page.tsx`

- [ ] **Step 1: Fetch excusals for the week and build the lookup map**

Replace:

```ts
  const [{ data: students }, { data: records }] = await Promise.all([
    admin.from('users').select('id, name').eq('role', 'student').order('name'),
    admin
      .from('daily_attendance')
      .select('student_id, attendance_date, am_checked_at, lunch_checked_at, pm_checked_at, am_is_flagged, lunch_is_flagged, pm_is_flagged, am_flag_reason, lunch_flag_reason, pm_flag_reason')
      .in('attendance_date', weekDates),
  ])

  const { rows, cohortAvgPct, belowThreshold, flagNotes } = computeWeeklyAttendance(
    students ?? [],
    (records ?? []) as AttendanceRecord[],
    weekDates,
    today,
  )
```

with:

```ts
  const [{ data: students }, { data: records }, { data: excusals }] = await Promise.all([
    admin.from('users').select('id, name').eq('role', 'student').order('name'),
    admin
      .from('daily_attendance')
      .select('student_id, attendance_date, am_checked_at, lunch_checked_at, pm_checked_at, am_is_flagged, lunch_is_flagged, pm_is_flagged, am_flag_reason, lunch_flag_reason, pm_flag_reason')
      .in('attendance_date', weekDates),
    admin
      .from('attendance_excusals')
      .select('student_id, excused_date, phases')
      .in('excused_date', weekDates),
  ])

  const excusalsByStudentDate = new Map(
    (excusals ?? []).map(e => [`${e.student_id}|${e.excused_date}`, e.phases as string[]])
  )

  const { rows, cohortAvgPct, belowThreshold, flagNotes } = computeWeeklyAttendance(
    students ?? [],
    (records ?? []) as AttendanceRecord[],
    weekDates,
    today,
    excusalsByStudentDate,
  )
```

- [ ] **Step 2: Show the excused count in each day cell**

Replace the day-cell rendering (around line 128-137):

```tsx
              {r.days.map(d => (
                <td
                  key={d.dateISO}
                  className={`py-1.5 pr-2 text-center font-mono ${
                    d.isFuture ? 'text-gray-300' : d.checkedCount < 3 ? 'text-red-600 font-bold' : ''
                  }`}
                >
                  {d.isFuture ? '—' : `${d.checkedCount}/3`}
                </td>
              ))}
```

with:

```tsx
              {r.days.map(d => {
                const possible = 3 - d.excusedCount
                const isShort = !d.isFuture && d.checkedCount < possible
                return (
                  <td
                    key={d.dateISO}
                    className={`py-1.5 pr-2 text-center font-mono ${
                      d.isFuture ? 'text-gray-300' : isShort ? 'text-red-600 font-bold' : ''
                    }`}
                    title={d.excusedCount > 0 ? `${d.excusedCount} phase(s) authorised absence` : undefined}
                  >
                    {d.isFuture
                      ? '—'
                      : d.excusedCount === 3
                        ? 'Ill/Appt'
                        : `${d.checkedCount}/${possible}`}
                  </td>
                )
              })}
```

- [ ] **Step 3: Update the footnote**

Replace:

```tsx
      <p className="text-[10px] text-gray-500 mt-2">
        Each day shows checks completed out of 3 (AM in / lunch / PM out). Week % counts only days that have already happened.
      </p>
```

with:

```tsx
      <p className="text-[10px] text-gray-500 mt-2">
        Each day shows checks completed out of 3 (AM in / lunch / PM out). Week % counts only days that have already happened.
        Phases marked as ill or an authorised appointment are excluded from both the check count and the week %.
      </p>
```

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit -p .`
Expected: no new errors from this file

- [ ] **Step 5: Commit**

```bash
git add "app/(admin)/admin/attendance/print/week/page.tsx"
git commit -m "feat: weekly print report shows excused days as authorised absence"
```

---

## Final check (after all 9 tasks)

- [ ] Run the full test suite: `npx jest` — expect all suites passing (existing suite plus the new `excusal.test.ts` and the 3 new `weeklyReport.test.ts` cases)
- [ ] Run `npm run build` — expect a clean production build including `/api/attendance/excuse` in the route output
- [ ] Run `npx next lint` — expect no new errors (pre-existing warnings unrelated to this feature are fine)
- [ ] Manually smoke-test on the Daily Attendance page: excuse a student as "Ill" (whole day), confirm all three phase cells show the pill and the Excused/Missing tiles update; excuse another student as "Appointment" narrowed to `am` only via a direct API call, confirm only the AM cell shows the pill and Lunch/PM still show Mark; undo one phase via the pill and confirm it reverts to Mark while the row-level pill still shows for the remaining phases; undo the whole row via the name-cell pill and confirm all three cells revert
- [ ] Push the branch and open a PR against `master`, matching this project's existing convention (see PRs #9–#20)
