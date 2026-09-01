# 1st-Year Weekly Timetable + Session Reminders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give 1st-year students an in-app weekly timetable (from the college Moodle eILP dashboard) with a push notification 15 minutes before each session, and give admin/coach/teacher a page to manage it.

**Architecture:** A new `timetable_slots` table stores a recurring weekly template (Mon/Tue/Thu/Fri only — Wednesday is match day, excluded at the DB level). Admin manages it through a REST-style API + form UI cloned from the existing `calendar_events` pattern. Students see it on a new `/timetable` page and as extra entries on the existing `/calendar` page. A new every-5-minutes cron reuses the existing web-push/FCM infrastructure to remind that slot's year-group students ~15 minutes before it starts, guarded against double-sends by a small `timetable_reminder_log` table.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase (Postgres + RLS), Jest + React Testing Library, existing `lib/webpush.ts` / `lib/firebase-admin.ts` push infrastructure, Vercel Cron.

## Global Constraints

- Use `@supabase/ssr` patterns already in the codebase — never the plain `supabase-js` browser client directly.
- Use `.maybeSingle()` for any Supabase lookup that may legitimately return no row.
- Every new cron route must be added to `vercel.json` in the same commit it is created.
- All Vercel cron schedules are UTC. This feature's cron uses `6-18` (06:00–18:59 UTC) specifically so it covers 07:00–19:59 BST and 06:00–18:59 GMT without needing seasonal adjustment.
- TypeScript strict — no `any` types without justification.
- Components go in `components/`, not inline in page files.
- All new features need Jest tests in `__tests__/`.
- Day-of-week convention throughout this feature is `0=Sun..6=Sat` (matches JS `Date#getDay()` and the existing `schedule_slots.day_of_week` column) — `timetable_slots.day_of_week` is constrained to `(1, 2, 4, 5)`, i.e. Monday, Tuesday, Thursday, Friday; `3` (Wednesday) is rejected by a DB check constraint.

---

## Task 1: Database migration — `timetable_slots` + `timetable_reminder_log`

**Files:**
- Create: `supabase/migrations/046_timetable.sql`

**Interfaces:**
- Produces: table `timetable_slots(id, year_group, day_of_week, start_time, end_time, title, location, tutor, created_by, created_at, updated_at)` and table `timetable_reminder_log(slot_id, session_date, sent_at)`, both RLS-enabled. Every later task that touches Supabase depends on these two tables existing.

- [ ] **Step 1: Write the migration file**

```sql
-- 046_timetable.sql
-- Run in Supabase Dashboard → SQL Editor (or via the Supabase MCP apply_migration tool)
--
-- 1st-year weekly academic timetable (from the college Moodle eILP dashboard).
-- Recurring weekly template — admin edits it in place, no per-week rows.
-- Wednesdays are match day: day_of_week deliberately excludes 3 at the DB
-- level, not just in the UI.

create table if not exists timetable_slots (
  id          uuid primary key default uuid_generate_v4(),
  year_group  smallint not null default 1 check (year_group in (1, 2)),
  day_of_week smallint not null check (day_of_week in (1, 2, 4, 5)), -- Mon,Tue,Thu,Fri (0=Sun..6=Sat convention; 3=Wed excluded, match day)
  start_time  time not null,
  end_time    time not null check (end_time > start_time),
  title       text not null,
  location    text,
  tutor       text,
  created_by  uuid not null references public.users(id),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

alter table timetable_slots enable row level security;

-- Staff manage (all commands) — matches calendar_events' pattern
create policy "staff can manage timetable_slots"
  on timetable_slots for all
  using (public.is_staff());

-- Students can only read their own year group's timetable
create policy "students read own year group timetable_slots"
  on timetable_slots for select
  to authenticated
  using (
    exists (
      select 1 from public.users
      where users.id = auth.uid()
        and users.role = 'student'
        and users.year_group = timetable_slots.year_group
    )
  );

-- Idempotency log for the reminder cron (app/api/cron/timetable-reminders).
-- Recurring slots have no per-date row of their own, so this is what stops
-- the every-5-minutes cron from double-sending for the same slot on the same
-- day if two invocations ever overlap.
create table if not exists timetable_reminder_log (
  slot_id      uuid not null references timetable_slots(id) on delete cascade,
  session_date date not null,
  sent_at      timestamptz default now(),
  primary key (slot_id, session_date)
);

alter table timetable_reminder_log enable row level security;

-- Staff-only — this is an internal cron bookkeeping table, not
-- student-facing. The cron itself uses the service-role client, which
-- bypasses RLS entirely.
create policy "staff can manage timetable_reminder_log"
  on timetable_reminder_log for all
  using (public.is_staff());

-- Verification (run separately):
--
-- 1. Both tables exist with RLS enabled (should return 2 rows, rowsecurity = true):
--   SELECT tablename, rowsecurity FROM pg_tables WHERE tablename IN ('timetable_slots', 'timetable_reminder_log');
--
-- 2. Policies exist (should return 3 rows: 2 on timetable_slots, 1 on timetable_reminder_log):
--   SELECT tablename, policyname, cmd FROM pg_policies WHERE tablename IN ('timetable_slots', 'timetable_reminder_log');
--
-- 3. Wednesday is rejected at the DB level (should raise a check_violation):
--   INSERT INTO timetable_slots (day_of_week, start_time, end_time, title, created_by)
--   VALUES (3, '09:00', '10:00', 'Should fail', (SELECT id FROM public.users LIMIT 1));
```

- [ ] **Step 2: Apply the migration**

Apply it via the Supabase MCP `apply_migration` tool (name: `timetable`, pass the SQL above), or paste it into the Supabase Dashboard → SQL Editor and run it. If using the MCP tool, first call `list_projects` if you don't already know the project id.

- [ ] **Step 3: Run the three verification queries from the file's comment block**

Run each via the Supabase MCP `execute_sql` tool (or the Dashboard SQL Editor).
Expected:
- Query 1 returns 2 rows, both `rowsecurity = true`.
- Query 2 returns 3 rows.
- Query 3 raises `new row for relation "timetable_slots" violates check constraint "timetable_slots_day_of_week_check"`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/046_timetable.sql
git commit -m "feat: add timetable_slots and timetable_reminder_log tables

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

## Task 2: `londonWeekday` date helper

**Files:**
- Modify: `lib/dates.ts`
- Test: `__tests__/lib/dates.test.ts`

**Interfaces:**
- Produces: `londonWeekday(date?: Date): number` — returns `0`–`6` (Sun–Sat, matching `Date#getDay()`), computed in `Europe/London`. Used by Task 10's cron route.

- [ ] **Step 1: Write the failing tests**

Add to `__tests__/lib/dates.test.ts` (append a new `describe` block after the existing `londonWallTimeToUTC` block):

```ts
import { londonDateISO, londonHour, londonWallTimeToUTC, londonWeekday } from '@/lib/dates'
```

(Update the existing import line at the top of the file to include `londonWeekday`.)

```ts
describe('londonWeekday', () => {
  it('returns 5 (Friday) for a Friday morning UTC instant', () => {
    // 7 Aug 2026 is a Friday
    expect(londonWeekday(new Date('2026-08-07T08:00:00Z'))).toBe(5)
  })

  it('returns 1 (Monday) for a Monday', () => {
    // 10 Aug 2026 is a Monday
    expect(londonWeekday(new Date('2026-08-10T08:00:00Z'))).toBe(1)
  })

  it('rolls over to the next London day when UTC is still on the previous day (BST)', () => {
    // 23:30 UTC on Wed 1 July 2026 = 00:30 London (BST) on Thu 2 July
    expect(londonWeekday(new Date('2026-07-01T23:30:00Z'))).toBe(4) // Thursday
  })

  it('matches the UTC weekday during GMT', () => {
    // 15 Jan 2026 is a Thursday, 23:30 UTC stays Thursday in GMT
    expect(londonWeekday(new Date('2026-01-15T23:30:00Z'))).toBe(4) // Thursday
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest __tests__/lib/dates.test.ts`
Expected: FAIL — `londonWeekday is not a function` (or similar import error).

- [ ] **Step 3: Implement `londonWeekday`**

Append to `lib/dates.ts`:

```ts
const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

/** Day of week (0=Sun..6=Sat, matching Date#getDay()) for the given instant in Europe/London. */
export function londonWeekday(date: Date = new Date()): number {
  const short = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/London',
    weekday: 'short',
  }).format(date)
  return WEEKDAY_INDEX[short]
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest __tests__/lib/dates.test.ts`
Expected: PASS (all tests in the file, including the new `londonWeekday` block).

- [ ] **Step 5: Commit**

```bash
git add lib/dates.ts __tests__/lib/dates.test.ts
git commit -m "feat: add londonWeekday date helper

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

## Task 3: `lib/timetable/timetableUtils.ts` — shared type + reminder-window logic

**Files:**
- Create: `lib/timetable/timetableUtils.ts`
- Test: `__tests__/lib/timetable/timetableUtils.test.ts`

**Interfaces:**
- Consumes: `londonWallTimeToUTC(dateISO: string, time: string): Date` from `lib/dates.ts` (existing).
- Produces:
  - `type TimetableSlotRow = { id: string; year_group: number; day_of_week: number; start_time: string; end_time: string; title: string; location?: string | null; tutor?: string | null }` — used by Tasks 4, 5, 6, 7, 9, 10.
  - `DAY_LABELS: Record<number, string>` — `{ 1: 'Monday', 2: 'Tuesday', 4: 'Thursday', 5: 'Friday' }` — used by Tasks 6 and 7.
  - `getSlotsDueForReminder(slots: TimetableSlotRow[], now: Date, todayISO: string): TimetableSlotRow[]` — used by Task 10.

- [ ] **Step 1: Write the failing tests**

Create `__tests__/lib/timetable/timetableUtils.test.ts`:

```ts
import { getSlotsDueForReminder, DAY_LABELS, type TimetableSlotRow } from '@/lib/timetable/timetableUtils'

function makeSlot(overrides: Partial<TimetableSlotRow> = {}): TimetableSlotRow {
  return {
    id: 'slot1',
    year_group: 1,
    day_of_week: 1,
    start_time: '10:00:00',
    end_time: '11:00:00',
    title: 'Football 1',
    location: 'Pitch 1',
    ...overrides,
  }
}

describe('DAY_LABELS', () => {
  it('labels Monday, Tuesday, Thursday and Friday only', () => {
    expect(DAY_LABELS).toEqual({ 1: 'Monday', 2: 'Tuesday', 4: 'Thursday', 5: 'Friday' })
  })
})

describe('getSlotsDueForReminder', () => {
  it('includes a slot starting in 15 minutes (during GMT, no offset)', () => {
    const slot = makeSlot({ start_time: '09:15:00' })
    const now = new Date('2026-01-12T09:00:00Z') // GMT, so 09:00 UTC = 09:00 London
    expect(getSlotsDueForReminder([slot], now, '2026-01-12')).toEqual([slot])
  })

  it('excludes a slot starting in only 5 minutes (too soon)', () => {
    const slot = makeSlot({ start_time: '09:05:00' })
    const now = new Date('2026-01-12T09:00:00Z')
    expect(getSlotsDueForReminder([slot], now, '2026-01-12')).toEqual([])
  })

  it('excludes a slot starting in 25 minutes (too far out)', () => {
    const slot = makeSlot({ start_time: '09:25:00' })
    const now = new Date('2026-01-12T09:00:00Z')
    expect(getSlotsDueForReminder([slot], now, '2026-01-12')).toEqual([])
  })

  it('includes a slot at the near edge of the window (13 minutes out)', () => {
    const slot = makeSlot({ start_time: '09:13:00' })
    const now = new Date('2026-01-12T09:00:00Z')
    expect(getSlotsDueForReminder([slot], now, '2026-01-12')).toEqual([slot])
  })

  it('excludes a slot at the far edge of the window (18 minutes out, exclusive)', () => {
    const slot = makeSlot({ start_time: '09:18:00' })
    const now = new Date('2026-01-12T09:00:00Z')
    expect(getSlotsDueForReminder([slot], now, '2026-01-12')).toEqual([])
  })

  it('accounts for BST when comparing against the London wall-clock start time', () => {
    // 08:15 UTC during BST = 09:15 London, so this is "in 15 minutes" from 08:00 UTC (=09:00 London)
    const slot = makeSlot({ start_time: '09:15:00' })
    const now = new Date('2026-08-10T08:00:00Z')
    expect(getSlotsDueForReminder([slot], now, '2026-08-10')).toEqual([slot])
  })

  it('returns multiple due slots and skips non-due ones', () => {
    const due = makeSlot({ id: 'due', start_time: '09:15:00' })
    const notDue = makeSlot({ id: 'not-due', start_time: '11:00:00' })
    const now = new Date('2026-01-12T09:00:00Z')
    expect(getSlotsDueForReminder([due, notDue], now, '2026-01-12')).toEqual([due])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest __tests__/lib/timetable/timetableUtils.test.ts`
Expected: FAIL — cannot find module `@/lib/timetable/timetableUtils`.

- [ ] **Step 3: Implement `lib/timetable/timetableUtils.ts`**

```ts
// lib/timetable/timetableUtils.ts
// Pure helpers for the 1st-year weekly timetable — dependency-free besides
// londonWallTimeToUTC, so the reminder-window logic is unit-testable without
// touching Supabase or push infrastructure.

import { londonWallTimeToUTC } from '@/lib/dates'

export type TimetableSlotRow = {
  id: string
  year_group: number
  day_of_week: number // 1=Mon, 2=Tue, 4=Thu, 5=Fri (0=Sun..6=Sat convention; 3=Wed never appears — match day)
  start_time: string // 'HH:MM' or 'HH:MM:SS'
  end_time: string
  title: string
  location?: string | null
  tutor?: string | null
}

export const DAY_LABELS: Record<number, string> = {
  1: 'Monday',
  2: 'Tuesday',
  4: 'Thursday',
  5: 'Friday',
}

/**
 * Returns the slots (already filtered to today's day_of_week by the caller)
 * whose start time falls 13–18 minutes from `now`. The 5-minute-wide window
 * matches the cron's 5-minute tick, so a slot starting "in 15 minutes" is
 * caught exactly once as the window slides forward each invocation.
 */
export function getSlotsDueForReminder(
  slots: TimetableSlotRow[],
  now: Date,
  todayISO: string
): TimetableSlotRow[] {
  return slots.filter(slot => {
    const startsAt = londonWallTimeToUTC(todayISO, slot.start_time)
    const minutesUntil = (startsAt.getTime() - now.getTime()) / 60_000
    return minutesUntil >= 13 && minutesUntil < 18
  })
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest __tests__/lib/timetable/timetableUtils.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/timetable/timetableUtils.ts __tests__/lib/timetable/timetableUtils.test.ts
git commit -m "feat: add timetable reminder-window logic

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

## Task 4: Calendar integration — `expandTimetableSlots` + new `'class'` event type

**Files:**
- Modify: `lib/calendar/calendarUtils.ts`
- Modify: `components/calendar/CalendarGrid.tsx`
- Test: `__tests__/lib/calendar/calendarUtils.test.ts`
- Test: `__tests__/components/calendar/CalendarGrid.test.tsx`

**Interfaces:**
- Consumes: `TimetableSlotRow` from `lib/timetable/timetableUtils.ts` (Task 3).
- Produces:
  - `CalendarEvent['type']` gains `'class'` (used by Task 9).
  - `expandTimetableSlots(slots: Array<Pick<TimetableSlotRow, 'day_of_week' | 'start_time' | 'title' | 'location'>>, windowStartISO: string, windowEndISO: string): CalendarEvent[]` (used by Task 9).
  - `getCalendarEvents(sessions, matches, assignments, calendarEvents?, classEvents?)` — 5th param, `CalendarEvent[]`, default `[]` (used by Task 9).

- [ ] **Step 1: Write the failing tests**

Add to `__tests__/lib/calendar/calendarUtils.test.ts` (append at the end of the file, after the existing `getCalendarEvents — calendar_events` block):

```ts
describe('expandTimetableSlots', () => {
  it('emits one event per matching weekday inside the window', () => {
    const slots = [
      { day_of_week: 1, start_time: '10:00:00', end_time: '11:00:00', title: 'Football 1', location: 'Pitch 1' },
    ]
    // 2024-06-03 is a Monday, 2024-06-10 is the next Monday
    const result = expandTimetableSlots(slots, '2024-06-01', '2024-06-14')
    expect(result).toEqual([
      { date: '2024-06-03', label: 'Football 1', type: 'class', time: '10am', description: 'Pitch 1' },
      { date: '2024-06-10', label: 'Football 1', type: 'class', time: '10am', description: 'Pitch 1' },
    ])
  })

  it('has no special-casing for Wednesday — the DB check constraint (Task 1) is what actually keeps day_of_week=3 rows from existing', () => {
    const slots = [
      { day_of_week: 3, start_time: '09:00:00', end_time: '10:00:00', title: 'Would be match day', location: null },
    ]
    const result = expandTimetableSlots(slots, '2024-06-01', '2024-06-07')
    // 2024-06-05 is a Wednesday inside this window — the function maps it like any other day_of_week
    expect(result.map(e => e.date)).toEqual(['2024-06-05'])
  })

  it('omits description when location is null', () => {
    const slots = [
      { day_of_week: 5, start_time: '14:00:00', end_time: '15:00:00', title: 'Wellbeing', location: null },
    ]
    // 2024-06-07 is a Friday
    const result = expandTimetableSlots(slots, '2024-06-07', '2024-06-07')
    expect(result[0].description).toBeUndefined()
  })

  it('returns an empty array for an empty slot list', () => {
    expect(expandTimetableSlots([], '2024-06-01', '2024-06-07')).toEqual([])
  })
})

describe('getCalendarEvents — class events', () => {
  it('includes classEvents passed as the 5th argument', () => {
    const classEvents: CalendarEvent[] = [
      { date: '2024-06-03', label: 'Football 1', type: 'class', time: '10am' },
    ]
    const result = getCalendarEvents([], [], [], [], classEvents)
    expect(result).toEqual(classEvents)
  })

  it('defaults the 5th argument to an empty array — existing 4-arg calls still work', () => {
    const result = getCalendarEvents([], [], [], [])
    expect(result).toHaveLength(0)
  })
})
```

Update the test file's import line at the top to also import `expandTimetableSlots`:

```ts
import {
  getDaysInMonth,
  getCalendarEvents,
  groupEventsByDate,
  formatEventTime,
  expandTimetableSlots,
  type CalendarEvent,
} from '@/lib/calendar/calendarUtils'
```

Add to `__tests__/components/calendar/CalendarGrid.test.tsx` (new `describe` block appended after the existing one):

```ts
describe('CalendarGrid — class event type', () => {
  const events: CalendarEvent[] = [
    { date: '2024-06-12', label: 'Football 1', type: 'class', time: '10am', description: 'Pitch 1' },
  ]

  it('shows the class type in the legend', () => {
    render(<CalendarGrid events={events} initialYear={2024} initialMonth={6} />)
    expect(screen.getByText('Class')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest __tests__/lib/calendar/calendarUtils.test.ts __tests__/components/calendar/CalendarGrid.test.tsx`
Expected: FAIL — `expandTimetableSlots` is not exported; `CalendarGrid` throws or the "Class" text is never found (TypeScript will also flag the unknown `'class'` type against the `Record<CalendarEvent['type'], string>` maps once the type changes in Step 3, so do Step 3 as one atomic change).

- [ ] **Step 3: Implement the changes**

In `lib/calendar/calendarUtils.ts`, add the import and update `CalendarEvent`:

```ts
import type { TimetableSlotRow } from '@/lib/timetable/timetableUtils'
```

```ts
export type CalendarEvent = {
  date: string // YYYY-MM-DD
  label: string
  type: 'session' | 'match' | 'deadline' | 'event' | 'class'
  time?: string
  description?: string
}
```

Update `getCalendarEvents`'s signature and body:

```ts
export function getCalendarEvents(
  sessions: AttendanceSessionRow[],
  matches: MatchEventRow[],
  assignments: AssignmentRow[],
  calendarEvents: CalendarEventRow[] = [],
  classEvents: CalendarEvent[] = [],
): CalendarEvent[] {
  const sessionEvents: CalendarEvent[] = sessions.map(s => ({
    date: s.scheduled_date,
    label: s.session_label || s.session_type,
    type: 'session',
  }))

  const matchEvents: CalendarEvent[] = matches.map(m => ({
    date: m.match_date,
    label: `vs ${m.opponent}`,
    type: 'match',
  }))

  const deadlineEvents: CalendarEvent[] = assignments.map(a => ({
    date: a.due_date,
    label: a.title,
    type: 'deadline',
  }))

  const customEvents: CalendarEvent[] = calendarEvents.map(e => ({
    date: e.event_date,
    label: e.title,
    type: 'event',
    ...(e.event_time ? { time: formatEventTime(e.event_time) } : {}),
    ...(e.description ? { description: e.description } : {}),
  }))

  return [...sessionEvents, ...matchEvents, ...deadlineEvents, ...customEvents, ...classEvents]
}
```

Add `expandTimetableSlots` (append after `getCalendarEvents`, before `groupEventsByDate`):

```ts
/**
 * Expands recurring weekly timetable_slots into concrete dated CalendarEvents
 * for every day in [windowStartISO, windowEndISO] whose weekday matches a slot.
 */
export function expandTimetableSlots(
  slots: Array<Pick<TimetableSlotRow, 'day_of_week' | 'start_time' | 'title' | 'location'>>,
  windowStartISO: string,
  windowEndISO: string,
): CalendarEvent[] {
  const events: CalendarEvent[] = []
  const cursor = new Date(windowStartISO + 'T00:00:00')
  const end = new Date(windowEndISO + 'T00:00:00')

  while (cursor <= end) {
    const dayOfWeek = cursor.getDay()
    const dateISO = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`

    for (const slot of slots) {
      if (slot.day_of_week !== dayOfWeek) continue
      events.push({
        date: dateISO,
        label: slot.title,
        type: 'class',
        time: formatEventTime(slot.start_time),
        ...(slot.location ? { description: slot.location } : {}),
      })
    }

    cursor.setDate(cursor.getDate() + 1)
  }

  return events
}
```

In `components/calendar/CalendarGrid.tsx`, add `'class'` to all three `Record<CalendarEvent['type'], string>` maps:

```ts
const DOT_COLOUR: Record<CalendarEvent['type'], string> = {
  session: 'bg-blue-500',
  match: 'bg-green-500',
  deadline: 'bg-red-500',
  event: 'bg-amber-500',
  class: 'bg-purple-500',
}

const EVENT_BADGE: Record<CalendarEvent['type'], string> = {
  session: 'bg-blue-100 text-blue-800 border-blue-200',
  match: 'bg-green-100 text-green-800 border-green-200',
  deadline: 'bg-red-100 text-red-800 border-red-200',
  event: 'bg-amber-100 text-amber-800 border-amber-200',
  class: 'bg-purple-100 text-purple-800 border-purple-200',
}

const TYPE_LABEL: Record<CalendarEvent['type'], string> = {
  session: 'Session',
  match: 'Match',
  deadline: 'Deadline',
  event: 'Event',
  class: 'Class',
}
```

Also update the day-cell dot logic to include class events, so the month grid actually shows a purple dot:

```ts
const hasSession = dayEvents.some(e => e.type === 'session')
const hasMatch = dayEvents.some(e => e.type === 'match')
const hasDeadline = dayEvents.some(e => e.type === 'deadline')
const hasEvent = dayEvents.some(e => e.type === 'event')
const hasClass = dayEvents.some(e => e.type === 'class')
```

```tsx
{hasEvent && (
  <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-amber-200' : 'bg-amber-500'}`} />
)}
{hasClass && (
  <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-purple-200' : 'bg-purple-500'}`} />
)}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest __tests__/lib/calendar/calendarUtils.test.ts __tests__/components/calendar/CalendarGrid.test.tsx`
Expected: PASS (all tests in both files).

- [ ] **Step 5: Commit**

```bash
git add lib/calendar/calendarUtils.ts components/calendar/CalendarGrid.tsx __tests__/lib/calendar/calendarUtils.test.ts __tests__/components/calendar/CalendarGrid.test.tsx
git commit -m "feat: add class event type for timetable slots on the calendar

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

## Task 5: Admin API routes — create/update/delete a timetable slot

**Files:**
- Create: `app/api/admin/timetable-slots/route.ts`
- Create: `app/api/admin/timetable-slots/[slotId]/route.ts`
- Test: `__tests__/lib/timetable/timetableSlotsRoute.test.ts`
- Test: `__tests__/lib/timetable/timetableSlotsIdRoute.test.ts`

**Interfaces:**
- Consumes: `requireStaff()` from `lib/auth/requireRole.ts` (existing).
- Produces: `POST /api/admin/timetable-slots`, `PATCH /api/admin/timetable-slots/[slotId]`, `DELETE /api/admin/timetable-slots/[slotId]` — used by Task 6's `TimetableManager`.

- [ ] **Step 1: Write the failing tests**

Create `__tests__/lib/timetable/timetableSlotsRoute.test.ts`:

```ts
/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'

const requireStaffMock = jest.fn()
const adminFromMock = jest.fn()

jest.mock('@/lib/auth/requireRole', () => ({
  requireStaff: () => requireStaffMock(),
}))

import { POST } from '@/app/api/admin/timetable-slots/route'

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/admin/timetable-slots', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

function validBody(): Record<string, unknown> {
  return {
    title: 'Football 1',
    day_of_week: 1,
    start_time: '11:00',
    end_time: '12:30',
    location: 'Tranmere Pitch 1',
    tutor: 'Chaid White',
  }
}

function setupAdmin() {
  const singleMock = jest.fn(async () => ({
    data: { id: 's1', ...validBody(), year_group: 1, created_at: '2026-09-01T00:00:00Z' },
    error: null,
  }))
  const selectMock = jest.fn(() => ({ single: singleMock }))
  const insertMock = jest.fn(() => ({ select: selectMock }))
  adminFromMock.mockImplementation((table: string) => {
    if (table === 'timetable_slots') return { insert: insertMock }
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

describe('POST /api/admin/timetable-slots', () => {
  it('creates a slot with year_group hardcoded to 1', async () => {
    authorizeAsStaff()
    const { insertMock } = setupAdmin()

    const res = await POST(makeRequest(validBody()))

    expect(res.status).toBe(200)
    expect(insertMock).toHaveBeenCalledTimes(1)
    const payload = insertMock.mock.calls[0][0] as { year_group: number; created_by: string }
    expect(payload.year_group).toBe(1)
    expect(payload.created_by).toBe('u1')
  })

  it('returns 400 when title is missing', async () => {
    authorizeAsStaff()
    setupAdmin()
    const { title, ...bodyWithoutTitle } = validBody()

    const res = await POST(makeRequest(bodyWithoutTitle))

    expect(res.status).toBe(400)
  })

  it('returns 400 when day_of_week is Wednesday', async () => {
    authorizeAsStaff()
    setupAdmin()

    const res = await POST(makeRequest({ ...validBody(), day_of_week: 3 }))

    expect(res.status).toBe(400)
  })

  it('returns 400 when end_time is not after start_time', async () => {
    authorizeAsStaff()
    setupAdmin()

    const res = await POST(makeRequest({ ...validBody(), start_time: '12:00', end_time: '11:00' }))

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

Create `__tests__/lib/timetable/timetableSlotsIdRoute.test.ts`:

```ts
/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'

const requireStaffMock = jest.fn()
const adminFromMock = jest.fn()

jest.mock('@/lib/auth/requireRole', () => ({
  requireStaff: () => requireStaffMock(),
}))

import { PATCH, DELETE } from '@/app/api/admin/timetable-slots/[slotId]/route'

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/admin/timetable-slots/s1', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

function validBody(): Record<string, unknown> {
  return {
    title: 'Football 1',
    day_of_week: 1,
    start_time: '11:00',
    end_time: '12:30',
    location: 'Tranmere Pitch 1',
    tutor: 'Chaid White',
  }
}

function setupAdmin() {
  const eqMock = jest.fn(async () => ({ error: null }))
  const updateMock = jest.fn(() => ({ eq: eqMock }))
  const deleteMock = jest.fn(() => ({ eq: eqMock }))
  adminFromMock.mockImplementation((table: string) => {
    if (table === 'timetable_slots') return { update: updateMock, delete: deleteMock }
    throw new Error(`Unexpected table ${table}`)
  })
  return { updateMock, deleteMock, eqMock }
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

describe('PATCH /api/admin/timetable-slots/[slotId]', () => {
  it('updates the slot', async () => {
    authorizeAsStaff()
    const { updateMock, eqMock } = setupAdmin()

    const res = await PATCH(makeRequest(validBody()), { params: { slotId: 's1' } })

    expect(res.status).toBe(200)
    expect(updateMock).toHaveBeenCalledTimes(1)
    expect(eqMock).toHaveBeenCalledWith('id', 's1')
  })

  it('returns 400 when day_of_week is Wednesday', async () => {
    authorizeAsStaff()
    setupAdmin()

    const res = await PATCH(makeRequest({ ...validBody(), day_of_week: 3 }), { params: { slotId: 's1' } })

    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/admin/timetable-slots/[slotId]', () => {
  it('deletes the slot', async () => {
    authorizeAsStaff()
    const { deleteMock, eqMock } = setupAdmin()

    const res = await DELETE(makeRequest(undefined), { params: { slotId: 's1' } })

    expect(res.status).toBe(200)
    expect(deleteMock).toHaveBeenCalledTimes(1)
    expect(eqMock).toHaveBeenCalledWith('id', 's1')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest __tests__/lib/timetable/timetableSlotsRoute.test.ts __tests__/lib/timetable/timetableSlotsIdRoute.test.ts`
Expected: FAIL — cannot find module `@/app/api/admin/timetable-slots/route` (and the `[slotId]` equivalent).

- [ ] **Step 3: Implement the routes**

Create `app/api/admin/timetable-slots/route.ts`:

```ts
import { requireStaff } from '@/lib/auth/requireRole'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const VALID_DAYS = [1, 2, 4, 5]

export async function POST(request: NextRequest) {
  const auth = await requireStaff()
  if (!auth.ok) return auth.response
  const { user, admin } = auth.ctx

  const body = await request.json()
  const { title, day_of_week, start_time, end_time, location, tutor } = body as {
    title?: string
    day_of_week?: number
    start_time?: string
    end_time?: string
    location?: string | null
    tutor?: string | null
  }

  if (!title?.trim()) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }
  if (!VALID_DAYS.includes(Number(day_of_week))) {
    return NextResponse.json({ error: 'day_of_week must be Monday, Tuesday, Thursday or Friday' }, { status: 400 })
  }
  if (!start_time || !end_time || start_time >= end_time) {
    return NextResponse.json({ error: 'end_time must be after start_time' }, { status: 400 })
  }

  const { data, error } = await admin
    .from('timetable_slots')
    .insert({
      title: title.trim(),
      day_of_week: Number(day_of_week),
      start_time,
      end_time,
      location: location?.trim() || null,
      tutor: tutor?.trim() || null,
      year_group: 1,
      created_by: user.id,
    })
    .select('id, title, day_of_week, start_time, end_time, location, tutor, year_group, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ slot: data })
}
```

Create `app/api/admin/timetable-slots/[slotId]/route.ts`:

```ts
import { requireStaff } from '@/lib/auth/requireRole'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const VALID_DAYS = [1, 2, 4, 5]

export async function PATCH(
  request: NextRequest,
  { params }: { params: { slotId: string } }
) {
  const auth = await requireStaff()
  if (!auth.ok) return auth.response
  const { admin } = auth.ctx

  const body = await request.json()
  const { title, day_of_week, start_time, end_time, location, tutor } = body as {
    title?: string
    day_of_week?: number
    start_time?: string
    end_time?: string
    location?: string | null
    tutor?: string | null
  }

  if (!title?.trim()) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }
  if (!VALID_DAYS.includes(Number(day_of_week))) {
    return NextResponse.json({ error: 'day_of_week must be Monday, Tuesday, Thursday or Friday' }, { status: 400 })
  }
  if (!start_time || !end_time || start_time >= end_time) {
    return NextResponse.json({ error: 'end_time must be after start_time' }, { status: 400 })
  }

  const { error } = await admin
    .from('timetable_slots')
    .update({
      title: title.trim(),
      day_of_week: Number(day_of_week),
      start_time,
      end_time,
      location: location?.trim() || null,
      tutor: tutor?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.slotId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { slotId: string } }
) {
  const auth = await requireStaff()
  if (!auth.ok) return auth.response
  const { admin } = auth.ctx

  const { error } = await admin.from('timetable_slots').delete().eq('id', params.slotId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest __tests__/lib/timetable/timetableSlotsRoute.test.ts __tests__/lib/timetable/timetableSlotsIdRoute.test.ts`
Expected: PASS (5 tests + 3 tests).

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/timetable-slots __tests__/lib/timetable/timetableSlotsRoute.test.ts __tests__/lib/timetable/timetableSlotsIdRoute.test.ts
git commit -m "feat: add admin API routes for timetable slots

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

## Task 6: Admin UI — `TimetableManager` + `/admin/timetable` page + nav

**Files:**
- Create: `app/(admin)/admin/timetable/TimetableManager.tsx`
- Create: `app/(admin)/admin/timetable/page.tsx`
- Modify: `components/layout/AdminSidebar.tsx`
- Modify: `components/layout/MobileAdminBar.tsx`

**Interfaces:**
- Consumes: `DAY_LABELS`, `type TimetableSlotRow` from `lib/timetable/timetableUtils.ts` (Task 3); `POST/PATCH/DELETE /api/admin/timetable-slots(/[slotId])` (Task 5).
- Produces: page at `/admin/timetable`; no other task depends on this one.

- [ ] **Step 1: Create `TimetableManager.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarPlus, Pencil, Trash2 } from 'lucide-react'
import { DAY_LABELS, type TimetableSlotRow } from '@/lib/timetable/timetableUtils'

type Props = { slots: TimetableSlotRow[] }

const DAY_OPTIONS = [1, 2, 4, 5] as const

const EMPTY_FORM = {
  title: '',
  day_of_week: 1 as number,
  start_time: '',
  end_time: '',
  location: '',
  tutor: '',
}

export function TimetableManager({ slots }: Props) {
  const router = useRouter()
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function startEdit(slot: TimetableSlotRow) {
    setEditingId(slot.id)
    setForm({
      title: slot.title,
      day_of_week: slot.day_of_week,
      start_time: slot.start_time.slice(0, 5),
      end_time: slot.end_time.slice(0, 5),
      location: slot.location ?? '',
      tutor: slot.tutor ?? '',
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || !form.start_time || !form.end_time) return
    setLoading(true)
    const body = {
      title: form.title.trim(),
      day_of_week: form.day_of_week,
      start_time: form.start_time,
      end_time: form.end_time,
      location: form.location.trim() || null,
      tutor: form.tutor.trim() || null,
    }
    const res = await fetch(
      editingId ? `/api/admin/timetable-slots/${editingId}` : '/api/admin/timetable-slots',
      {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    )
    const data = await res.json()
    setLoading(false)
    if (res.ok) {
      cancelEdit()
      router.refresh()
    } else {
      alert(data.error ?? 'Failed to save session')
    }
  }

  async function remove(id: string, title: string) {
    if (!confirm(`Delete "${title}"?`)) return
    const res = await fetch(`/api/admin/timetable-slots/${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (res.ok) {
      if (editingId === id) cancelEdit()
      router.refresh()
    } else {
      alert(data.error ?? 'Failed to delete session')
    }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={submit} className="rounded-2xl border bg-white p-4 space-y-3 shadow-sm">
        <p className="text-sm font-semibold text-tranmere-blue">
          {editingId ? 'Edit session' : 'Add session'}
        </p>
        <input
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          placeholder="Title, e.g. Coaching & Leadership Prep"
          className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-tranmere-blue outline-none"
          required
        />
        <div className="flex gap-2">
          <select
            value={form.day_of_week}
            onChange={e => setForm(f => ({ ...f, day_of_week: Number(e.target.value) }))}
            className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-tranmere-blue outline-none"
          >
            {DAY_OPTIONS.map(day => (
              <option key={day} value={day}>{DAY_LABELS[day]}</option>
            ))}
          </select>
          <input
            type="time"
            value={form.start_time}
            onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
            className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-tranmere-blue outline-none"
            required
          />
          <input
            type="time"
            value={form.end_time}
            onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))}
            className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-tranmere-blue outline-none"
            required
          />
        </div>
        <div className="flex gap-2">
          <input
            value={form.location}
            onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
            placeholder="Location (optional)"
            className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-tranmere-blue outline-none"
          />
          <input
            value={form.tutor}
            onChange={e => setForm(f => ({ ...f, tutor: e.target.value }))}
            placeholder="Tutor (optional)"
            className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-tranmere-blue outline-none"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={!form.title.trim() || !form.start_time || !form.end_time || loading}
            className="flex items-center gap-1.5 bg-tranmere-blue text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-blue-900 transition-colors"
          >
            <CalendarPlus size={15} />
            {loading ? 'Saving…' : editingId ? 'Save changes' : 'Add session'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={cancelEdit}
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="space-y-2">
        {slots.length === 0 ? (
          <p className="text-sm text-muted-foreground">No timetable sessions yet.</p>
        ) : (
          slots.map(slot => (
            <div key={slot.id} className="flex items-start gap-3 rounded-xl border bg-white p-3 shadow-sm">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-tranmere-blue">
                  {DAY_LABELS[slot.day_of_week]} · {slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)}
                </p>
                <p className="text-sm font-medium truncate">{slot.title}</p>
                {(slot.location || slot.tutor) && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {[slot.location, slot.tutor].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => startEdit(slot)}
                  aria-label={`Edit ${slot.title}`}
                  className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => remove(slot.id, slot.title)}
                  aria-label={`Delete ${slot.title}`}
                  className="p-2 rounded-lg hover:bg-red-50 text-red-500"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `app/(admin)/admin/timetable/page.tsx`**

```tsx
import { createAdminClient } from '@/lib/supabase/admin'
import { TimetableManager } from './TimetableManager'

export const dynamic = 'force-dynamic'

export default async function AdminTimetablePage() {
  const supabase = createAdminClient()

  const { data: slots } = await supabase
    .from('timetable_slots')
    .select('id, title, day_of_week, start_time, end_time, location, tutor, year_group')
    .eq('year_group', 1)
    .order('day_of_week', { ascending: true })
    .order('start_time', { ascending: true })

  return (
    <div className="space-y-4">
      <div className="py-2">
        <h1 className="text-lg font-bold text-tranmere-blue">1st-Year Timetable</h1>
        <p className="text-xs text-muted-foreground">
          Weekly sessions for 1st-year students. Wednesdays have none — that&apos;s match day.
        </p>
      </div>
      <TimetableManager slots={slots ?? []} />
    </div>
  )
}
```

- [ ] **Step 3: Add the nav entry to `AdminSidebar.tsx` and `MobileAdminBar.tsx`**

In `components/layout/AdminSidebar.tsx`, add `CalendarClock` to the lucide-react import and insert a nav entry right after Calendar:

```ts
import { Users, Bell, BarChart2, GraduationCap, LogOut, Calendar, CalendarDays, CalendarClock, Wifi, Activity, LayoutGrid, Plug, MessageSquare, Megaphone, Home, ClipboardList, ShieldAlert, Network, UserPlus, Users2, Banknote, FolderOpen } from 'lucide-react'
```

```ts
const nav = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: Home },
  { href: '/documents', label: 'Documents', icon: FolderOpen },
  { href: '/admin/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/admin/timetable', label: 'Timetable', icon: CalendarClock },
  { href: '/admin/users', label: 'Users', icon: Users },
  // ...rest unchanged
```

Make the identical two changes (import + nav array entry) in `components/layout/MobileAdminBar.tsx` — it duplicates the same `nav` array.

- [ ] **Step 4: Verify it compiles and the page renders**

Run: `npx tsc --noEmit`
Expected: no new type errors.

Run: `npm run dev`, sign in as an admin, navigate to `/admin/timetable`.
Expected: page loads, shows the "Add session" form and an empty list; adding a session (e.g. day Monday, 09:00–10:00, title "Test Session") makes it appear in the list below; editing and deleting both work.

- [ ] **Step 5: Commit**

```bash
git add "app/(admin)/admin/timetable" components/layout/AdminSidebar.tsx components/layout/MobileAdminBar.tsx
git commit -m "feat: add admin timetable management page and nav entry

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

## Task 7: Student `TimetableGrid` component + `/timetable` page

**Files:**
- Create: `components/timetable/TimetableGrid.tsx`
- Create: `app/(student)/timetable/page.tsx`
- Test: `__tests__/components/timetable/TimetableGrid.test.tsx`

**Interfaces:**
- Consumes: `DAY_LABELS`, `type TimetableSlotRow` from `lib/timetable/timetableUtils.ts` (Task 3).
- Produces: page at `/timetable`; `TimetableGrid` component, no other task depends on it directly (Task 8 links to the page, not the component).

- [ ] **Step 1: Write the failing test**

Create `__tests__/components/timetable/TimetableGrid.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { TimetableGrid } from '@/components/timetable/TimetableGrid'
import type { TimetableSlotRow } from '@/lib/timetable/timetableUtils'

describe('TimetableGrid', () => {
  it('shows a match-day card for Wednesday', () => {
    render(<TimetableGrid slots={[]} />)
    expect(screen.getByText('⚽ Match day — no timetable')).toBeInTheDocument()
  })

  it('renders a session under its day with time, location and tutor', () => {
    const slots: TimetableSlotRow[] = [
      {
        id: '1', year_group: 1, day_of_week: 1,
        start_time: '11:00:00', end_time: '12:30:00',
        title: 'Football 1', location: 'Tranmere Pitch 1', tutor: 'Chaid White',
      },
    ]
    render(<TimetableGrid slots={slots} />)
    expect(screen.getByText('Monday')).toBeInTheDocument()
    expect(screen.getByText('Football 1')).toBeInTheDocument()
    expect(screen.getByText('11:00–12:30 · Tranmere Pitch 1 · Chaid White')).toBeInTheDocument()
  })

  it('shows a placeholder for a weekday with nothing scheduled', () => {
    render(<TimetableGrid slots={[]} />)
    expect(screen.getAllByText('Nothing scheduled.').length).toBe(4) // Mon, Tue, Thu, Fri
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest __tests__/components/timetable/TimetableGrid.test.tsx`
Expected: FAIL — cannot find module `@/components/timetable/TimetableGrid`.

- [ ] **Step 3: Implement `TimetableGrid.tsx`**

```tsx
import { DAY_LABELS, type TimetableSlotRow } from '@/lib/timetable/timetableUtils'

const WEEK_ORDER = [1, 2, 3, 4, 5] // 3 (Wednesday) renders the fixed match-day card

type Props = { slots: TimetableSlotRow[] }

export function TimetableGrid({ slots }: Props) {
  return (
    <div className="space-y-4">
      {WEEK_ORDER.map(day => {
        if (day === 3) {
          return (
            <div key="wed" className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4">
              <p className="text-sm font-semibold text-tranmere-blue">Wednesday</p>
              <p className="text-sm text-muted-foreground mt-1">⚽ Match day — no timetable</p>
            </div>
          )
        }

        const daySlots = slots
          .filter(s => s.day_of_week === day)
          .sort((a, b) => a.start_time.localeCompare(b.start_time))

        return (
          <div key={day} className="rounded-2xl border bg-white p-4 shadow-sm space-y-2">
            <p className="text-sm font-semibold text-tranmere-blue">{DAY_LABELS[day]}</p>
            {daySlots.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing scheduled.</p>
            ) : (
              daySlots.map(slot => (
                <div key={slot.id} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
                  <p className="font-medium">{slot.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {[
                      `${slot.start_time.slice(0, 5)}–${slot.end_time.slice(0, 5)}`,
                      slot.location,
                      slot.tutor,
                    ].filter(Boolean).join(' · ')}
                  </p>
                </div>
              ))
            )}
          </div>
        )
      })}
    </div>
  )
}
```

Create `app/(student)/timetable/page.tsx`:

```tsx
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { TimetableGrid } from '@/components/timetable/TimetableGrid'

export const dynamic = 'force-dynamic'

export default async function TimetablePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('users')
    .select('year_group')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.year_group !== 1) {
    return (
      <div className="space-y-4">
        <div className="py-2">
          <h1 className="text-lg font-bold text-tranmere-blue">Timetable</h1>
        </div>
        <p className="text-sm text-muted-foreground">No timetable published for your year group yet.</p>
      </div>
    )
  }

  const { data: slots } = await admin
    .from('timetable_slots')
    .select('id, title, day_of_week, start_time, end_time, location, tutor, year_group')
    .eq('year_group', 1)
    .order('day_of_week', { ascending: true })
    .order('start_time', { ascending: true })

  return (
    <div className="space-y-4">
      <div className="py-2">
        <h1 className="text-lg font-bold text-tranmere-blue">Timetable</h1>
        <p className="text-xs text-muted-foreground">Your weekly college sessions</p>
      </div>
      <TimetableGrid slots={slots ?? []} />
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest __tests__/components/timetable/TimetableGrid.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add components/timetable/TimetableGrid.tsx "app/(student)/timetable" __tests__/components/timetable/TimetableGrid.test.tsx
git commit -m "feat: add student timetable page

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

## Task 8: Student nav — show "Timetable" only for `year_group = 1`

**Files:**
- Modify: `components/layout/BottomNav.tsx`
- Modify: `components/layout/SideNav.tsx`
- Modify: `app/(student)/layout.tsx`
- Test: `__tests__/components/layout/BottomNav.test.tsx`
- Test: `__tests__/components/layout/SideNav.test.tsx`

**Interfaces:**
- Consumes: `/timetable` page from Task 7 (just a link target).
- Produces: `BottomNav({ showTimetable?: boolean })`, `SideNav({ userName, avatarUrl, role, showTimetable?: boolean })` — both now accept the new prop; `app/(student)/layout.tsx` passes it through.

- [ ] **Step 1: Write the failing tests**

Create `__tests__/components/layout/BottomNav.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { usePathname } from 'next/navigation'
import { BottomNav } from '@/components/layout/BottomNav'

jest.mock('next/navigation', () => ({ usePathname: jest.fn() }))

beforeEach(() => {
  (usePathname as jest.Mock).mockReturnValue('/dashboard')
})

describe('BottomNav', () => {
  it('does not show Timetable by default', () => {
    render(<BottomNav />)
    expect(screen.queryByText('Timetable')).not.toBeInTheDocument()
  })

  it('shows Timetable when showTimetable is true', () => {
    render(<BottomNav showTimetable />)
    expect(screen.getByText('Timetable')).toBeInTheDocument()
  })
})
```

Create `__tests__/components/layout/SideNav.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { usePathname } from 'next/navigation'
import { SideNav } from '@/components/layout/SideNav'

jest.mock('next/navigation', () => ({ usePathname: jest.fn() }))
jest.mock('@/app/(auth)/login/actions', () => ({ signOut: jest.fn() }))

beforeEach(() => {
  (usePathname as jest.Mock).mockReturnValue('/dashboard')
})

describe('SideNav', () => {
  it('does not show Timetable by default', () => {
    render(<SideNav userName="Test Player" avatarUrl={null} role="student" />)
    expect(screen.queryByText('Timetable')).not.toBeInTheDocument()
  })

  it('shows Timetable when showTimetable is true', () => {
    render(<SideNav userName="Test Player" avatarUrl={null} role="student" showTimetable />)
    expect(screen.getByText('Timetable')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest __tests__/components/layout/BottomNav.test.tsx __tests__/components/layout/SideNav.test.tsx`
Expected: FAIL — "Timetable" text never found even with `showTimetable` (prop doesn't exist yet, TypeScript will also flag the unknown prop).

- [ ] **Step 3: Implement the changes**

Replace `components/layout/BottomNav.tsx` in full:

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, User, Heart, CalendarDays, CalendarClock, Dumbbell, Target, FolderOpen } from 'lucide-react'

type Props = { showTimetable?: boolean }

export function BottomNav({ showTimetable = false }: Props) {
  const pathname = usePathname()
  const nav = [
    { href: '/dashboard',  label: 'Home',      icon: Home },
    { href: '/documents',  label: 'Documents', icon: FolderOpen },
    { href: '/calendar',   label: 'Calendar',  icon: CalendarDays },
    ...(showTimetable ? [{ href: '/timetable', label: 'Timetable', icon: CalendarClock }] : []),
    { href: '/gym',        label: 'Gym',        icon: Dumbbell },
    { href: '/targets',    label: 'Targets',   icon: Target },
    { href: '/wellbeing',  label: 'Wellbeing', icon: Heart },
    { href: '/profile',    label: 'Profile',   icon: User },
  ]
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around items-center h-16 z-50 safe-area-inset-bottom">
      {nav.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full ${active ? 'text-tranmere-blue' : 'text-gray-400'}`}
          >
            <Icon size={18} strokeWidth={active ? 2.5 : 1.5} />
            <span className="text-[10px] font-medium leading-tight">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
```

Replace `components/layout/SideNav.tsx` in full:

```tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, GraduationCap, Apple, Dumbbell, Trophy, User, LogOut, Activity, MessageSquare, Brain, FolderOpen, CalendarClock } from 'lucide-react'
import Image from 'next/image'
import { signOut } from '@/app/(auth)/login/actions'
import { MOODLE_STUDENT_URL } from '@/lib/config/moodle'

type Props = {
  userName: string
  avatarUrl: string | null
  role: string
  showTimetable?: boolean
}

export function SideNav({ userName, avatarUrl, role, showTimetable = false }: Props) {
  const pathname = usePathname()
  const initials = userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  const nav = [
    { href: '/dashboard', label: 'Home', icon: Home },
    { href: '/documents', label: 'Documents', icon: FolderOpen },
    ...(showTimetable ? [{ href: '/timetable', label: 'Timetable', icon: CalendarClock }] : []),
    { href: MOODLE_STUDENT_URL, label: 'Moodle', icon: GraduationCap, external: true },
    { href: '/nutrition', label: 'Nutrition', icon: Apple },
    { href: '/gps', label: 'GPS Dashboard', icon: Activity },
    { href: '/chat', label: 'Chat', icon: MessageSquare },
    { href: '/training', label: 'Training', icon: Dumbbell },
    { href: '/matches', label: 'Matches', icon: Trophy },
    { href: '/ai-report', label: 'AI Report', icon: Brain },
    { href: '/profile', label: 'Profile', icon: User },
  ]

  return (
    <aside className="w-56 bg-tranmere-blue flex flex-col min-h-[100dvh] shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
        <Image
          src="https://upload.wikimedia.org/wikipedia/en/thumb/5/55/Tranmere_Rovers_FC_crest.svg/960px-Tranmere_Rovers_FC_crest.svg.png"
          alt="Tranmere Rovers"
          width={36}
          height={36}
        />
        <div>
          <p className="text-white font-bold text-sm leading-tight">Tranmere</p>
          <p className="text-white/60 text-xs">Tracker</p>
        </div>
      </div>

      {/* Logged-in user card */}
      <div className="mx-3 mt-4 flex items-center gap-2.5 rounded-xl bg-white/10 p-2.5">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt={userName} className="w-10 h-10 rounded-full object-cover ring-2 ring-white/20" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white text-xs font-bold ring-2 ring-white/20">
            {initials}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-semibold truncate">{userName}</p>
          <p className="text-white/60 text-xs capitalize">{role}</p>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {nav.map(({ href, label, icon: Icon, external }) => {
          const active = !external && (pathname === href || pathname.startsWith(href + '/'))
          const className = `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            active ? 'bg-white/20 text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'
          }`
          return external ? (
            <a key={href} href={href} target="_blank" rel="noopener noreferrer" className={className}>
              <Icon size={18} strokeWidth={1.5} />
              {label}
            </a>
          ) : (
            <Link key={href} href={href} className={className}>
              <Icon size={18} strokeWidth={active ? 2.5 : 1.5} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Sign out */}
      <form action={signOut} className="px-3 pb-5">
        <button
          type="submit"
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-white/60 hover:bg-white/10 hover:text-white transition-colors"
        >
          <LogOut size={18} />
          Sign Out
        </button>
      </form>
    </aside>
  )
}
```

In `app/(student)/layout.tsx`, update the `select()` call and both nav render sites:

```ts
const { data: profile } = await adminClient
    .from('users')
    .select('name, avatar_url, role, year_group')
    .eq('id', user.id)
    .maybeSingle()
```

```tsx
<SideNav userName={profile?.name ?? 'Player'} avatarUrl={profile?.avatar_url ?? null} role={profile?.role ?? 'student'} showTimetable={profile?.year_group === 1} />
```

```tsx
<BottomNav showTimetable={profile?.year_group === 1} />
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest __tests__/components/layout/BottomNav.test.tsx __tests__/components/layout/SideNav.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add components/layout/BottomNav.tsx components/layout/SideNav.tsx "app/(student)/layout.tsx" __tests__/components/layout/BottomNav.test.tsx __tests__/components/layout/SideNav.test.tsx
git commit -m "feat: show Timetable nav link for 1st-year students only

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

## Task 9: Wire timetable slots into the student `/calendar` page

**Files:**
- Modify: `app/(student)/calendar/page.tsx`

**Interfaces:**
- Consumes: `expandTimetableSlots` from `lib/calendar/calendarUtils.ts` (Task 4); `timetable_slots` table (Task 1).
- Produces: nothing further downstream — this is the last consumer of the calendar-integration pieces.

- [ ] **Step 1: Modify `app/(student)/calendar/page.tsx`**

Replace the file in full:

```tsx
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { CalendarGrid } from '@/components/calendar/CalendarGrid'
import { getCalendarEvents, expandTimetableSlots } from '@/lib/calendar/calendarUtils'

export const dynamic = 'force-dynamic'

export default async function CalendarPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('users')
    .select('year_group')
    .eq('id', user.id)
    .maybeSingle()

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1 // 1-based

  // Fetch a 3-month window centred on the current month so nav feels instant
  const windowStart = new Date(year, month - 2, 1).toISOString().split('T')[0]
  const windowEnd   = new Date(year, month + 1, 0).toISOString().split('T')[0]

  const [
    { data: sessions },
    { data: matches },
    { data: assignments },
    { data: calendarEvents },
    { data: timetableSlots },
  ] = await Promise.all([
    supabase
      .from('attendance_sessions')
      .select('scheduled_date, session_label, session_type, opens_at, closes_at')
      .gte('scheduled_date', windowStart)
      .lte('scheduled_date', windowEnd)
      .order('scheduled_date'),

    supabase
      .from('match_events')
      .select('match_date, opponent, location')
      .gte('match_date', windowStart)
      .lte('match_date', windowEnd)
      .order('match_date'),

    supabase
      .from('assignments')
      .select('due_date, title')
      .gte('due_date', windowStart)
      .lte('due_date', windowEnd)
      .order('due_date'),

    supabase
      .from('calendar_events')
      .select('id, title, event_date, event_time, description')
      .gte('event_date', windowStart)
      .lte('event_date', windowEnd)
      .order('event_date'),

    profile?.year_group === 1
      ? supabase
          .from('timetable_slots')
          .select('id, year_group, day_of_week, start_time, end_time, title, location')
          .eq('year_group', 1)
      : Promise.resolve({ data: [] as never[] }),
  ])

  const classEvents = expandTimetableSlots(timetableSlots ?? [], windowStart, windowEnd)

  const events = getCalendarEvents(
    sessions  ?? [],
    matches   ?? [],
    assignments ?? [],
    calendarEvents ?? [],
    classEvents,
  )

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="py-2">
        <h1 className="text-lg font-bold text-tranmere-blue">Calendar</h1>
        <p className="text-xs text-muted-foreground">Sessions, matches, deadlines &amp; events</p>
      </div>

      {/* Calendar card */}
      <div className="rounded-2xl bg-white border border-gray-200 p-4 shadow-sm">
        <CalendarGrid
          events={events}
          initialYear={year}
          initialMonth={month}
        />
      </div>

      {/* Colour key summary below the card */}
      <div className="rounded-2xl bg-gray-50 border border-gray-200 p-4 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Key</p>
        <div className="grid grid-cols-3 gap-2 text-xs text-gray-700">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-500 shrink-0" />
            <span>Attendance session</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-500 shrink-0" />
            <span>Match</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500 shrink-0" />
            <span>Assignment deadline</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-amber-500 shrink-0" />
            <span>Event</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-purple-500 shrink-0" />
            <span>Class</span>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new type errors.

- [ ] **Step 3: Manually verify in the dev server**

Run: `npm run dev`, sign in as a `year_group = 1` student who has at least one timetable slot (added in Task 6's manual check), navigate to `/calendar`.
Expected: the day matching that slot's weekday shows a purple dot; selecting that day shows the class entry with its time and location; the "Class" legend entry appears at the bottom.

- [ ] **Step 4: Commit**

```bash
git add "app/(student)/calendar/page.tsx"
git commit -m "feat: show timetable classes on the student calendar

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

## Task 10: Reminder cron — `/api/cron/timetable-reminders`

**Files:**
- Create: `app/api/cron/timetable-reminders/route.ts`
- Modify: `vercel.json`
- Test: `__tests__/lib/timetable/timetableRemindersRoute.test.ts`

**Interfaces:**
- Consumes: `verifyCronSecret` (`lib/security.ts`), `londonDateISO`/`londonWeekday` (`lib/dates.ts`, Task 2), `getSlotsDueForReminder` (`lib/timetable/timetableUtils.ts`, Task 3), `sendPushNotification` (`lib/webpush.ts`), `sendFcmBatch` (`lib/firebase-admin.ts`), `createAdminClient` (`lib/supabase/admin.ts`) — all existing except `getSlotsDueForReminder`/`londonWeekday`.
- Produces: `GET /api/cron/timetable-reminders` — nothing else depends on it; this is the final task.

- [ ] **Step 1: Write the failing tests**

Create `__tests__/lib/timetable/timetableRemindersRoute.test.ts`:

```ts
/**
 * @jest-environment node
 */

const verifyCronSecretMock = jest.fn()
const londonDateISOMock = jest.fn()
const londonWeekdayMock = jest.fn()
const getSlotsDueForReminderMock = jest.fn()
const sendPushNotificationMock = jest.fn()
const sendFcmBatchMock = jest.fn()
const adminFromMock = jest.fn()

jest.mock('@/lib/security', () => ({
  verifyCronSecret: (...args: unknown[]) => verifyCronSecretMock(...args),
}))
jest.mock('@/lib/dates', () => ({
  londonDateISO: (...args: unknown[]) => londonDateISOMock(...args),
  londonWeekday: (...args: unknown[]) => londonWeekdayMock(...args),
}))
jest.mock('@/lib/timetable/timetableUtils', () => ({
  getSlotsDueForReminder: (...args: unknown[]) => getSlotsDueForReminderMock(...args),
}))
jest.mock('@/lib/webpush', () => ({
  sendPushNotification: (...args: unknown[]) => sendPushNotificationMock(...args),
}))
jest.mock('@/lib/firebase-admin', () => ({
  sendFcmBatch: (...args: unknown[]) => sendFcmBatchMock(...args),
}))
jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: adminFromMock }),
}))

import { GET } from '@/app/api/cron/timetable-reminders/route'

function makeRequest(): Request {
  return new Request('http://localhost/api/cron/timetable-reminders', {
    headers: { authorization: 'Bearer test-secret' },
  })
}

const SLOT = {
  id: 'slot1', year_group: 1, day_of_week: 1,
  start_time: '10:00:00', end_time: '11:00:00',
  title: 'Football 1', location: 'Pitch 1',
}

type SetupOpts = {
  todaysSlots?: Array<typeof SLOT>
  alreadySent?: Array<{ slot_id: string }>
  students?: Array<{ id: string }>
  subs?: Array<{ endpoint: string; p256dh: string; auth: string }>
  tokens?: string[]
}

function setupAdmin(opts: SetupOpts = {}) {
  const {
    todaysSlots = [SLOT],
    alreadySent = [],
    students = [{ id: 'student1' }],
    subs = [],
    tokens = [],
  } = opts
  const insertMock = jest.fn(async () => ({ error: null }))
  const deleteInMock = jest.fn(async () => ({ error: null }))

  adminFromMock.mockImplementation((table: string) => {
    if (table === 'timetable_slots') {
      return { select: () => ({ eq: async () => ({ data: todaysSlots, error: null }) }) }
    }
    if (table === 'timetable_reminder_log') {
      return {
        select: () => ({ eq: () => ({ in: async () => ({ data: alreadySent, error: null }) }) }),
        insert: insertMock,
      }
    }
    if (table === 'users') {
      return { select: () => ({ eq: () => ({ eq: async () => ({ data: students, error: null }) }) }) }
    }
    if (table === 'push_subscriptions') {
      return {
        select: () => ({ in: async () => ({ data: subs, error: null }) }),
        delete: () => ({ in: deleteInMock }),
      }
    }
    if (table === 'native_push_tokens') {
      return { select: () => ({ in: async () => ({ data: tokens.map(t => ({ token: t })), error: null }) }) }
    }
    throw new Error(`Unexpected table ${table}`)
  })

  return { insertMock, deleteInMock }
}

beforeEach(() => {
  verifyCronSecretMock.mockReset()
  londonDateISOMock.mockReset()
  londonWeekdayMock.mockReset()
  getSlotsDueForReminderMock.mockReset()
  sendPushNotificationMock.mockReset()
  sendFcmBatchMock.mockReset()
  adminFromMock.mockReset()

  verifyCronSecretMock.mockReturnValue(true)
  londonDateISOMock.mockReturnValue('2026-09-07')
  londonWeekdayMock.mockReturnValue(1)
  getSlotsDueForReminderMock.mockReturnValue([SLOT])
  sendPushNotificationMock.mockResolvedValue(undefined)
  sendFcmBatchMock.mockResolvedValue({ sent: 0, failed: 0 })
})

describe('GET /api/cron/timetable-reminders', () => {
  it('returns 401 when verifyCronSecret fails', async () => {
    verifyCronSecretMock.mockReturnValue(false)
    setupAdmin()
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
  })

  it('returns sent: 0 when there are no slots today', async () => {
    setupAdmin({ todaysSlots: [] })
    const res = await GET(makeRequest())
    expect(await res.json()).toEqual({ sent: 0, slots: 0 })
  })

  it('returns sent: 0 when no slot is due yet', async () => {
    getSlotsDueForReminderMock.mockReturnValue([])
    setupAdmin()
    const res = await GET(makeRequest())
    expect(await res.json()).toEqual({ sent: 0, slots: 0 })
    expect(sendPushNotificationMock).not.toHaveBeenCalled()
  })

  it('skips a slot already logged as sent today', async () => {
    setupAdmin({ alreadySent: [{ slot_id: 'slot1' }] })
    const res = await GET(makeRequest())
    expect(await res.json()).toEqual({ sent: 0, slots: 0 })
    expect(sendPushNotificationMock).not.toHaveBeenCalled()
  })

  it('sends push + FCM to the slot year-group and logs the send', async () => {
    const { insertMock } = setupAdmin({
      subs: [{ endpoint: 'https://push.example/1', p256dh: 'p256dh', auth: 'auth' }],
      tokens: ['tok1'],
    })
    sendFcmBatchMock.mockResolvedValue({ sent: 1, failed: 0 })

    const res = await GET(makeRequest())
    const json = await res.json()

    expect(sendPushNotificationMock).toHaveBeenCalledTimes(1)
    expect(sendFcmBatchMock).toHaveBeenCalledTimes(1)
    expect(json).toEqual({ sent: 2, slots: 1 })
    expect(insertMock).toHaveBeenCalledWith({ slot_id: 'slot1', session_date: '2026-09-07' })
  })

  it('still logs the slot as sent when there are no matching students', async () => {
    const { insertMock } = setupAdmin({ students: [] })
    const res = await GET(makeRequest())
    const json = await res.json()
    expect(json).toEqual({ sent: 0, slots: 1 })
    expect(insertMock).toHaveBeenCalledWith({ slot_id: 'slot1', session_date: '2026-09-07' })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest __tests__/lib/timetable/timetableRemindersRoute.test.ts`
Expected: FAIL — cannot find module `@/app/api/cron/timetable-reminders/route`.

- [ ] **Step 3: Implement the route**

Create `app/api/cron/timetable-reminders/route.ts`:

```ts
// Vercel Cron: GET /api/cron/timetable-reminders — runs every 5 minutes,
// Mon-Fri, 06:00-18:59 UTC (covers 07:00-19:59 BST and 06:00-18:59 GMT).
// Sends a push notification to a slot's year-group students ~15 minutes
// before it starts. Idempotent via timetable_reminder_log even if two
// invocations somehow overlap.

import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushNotification } from '@/lib/webpush'
import { sendFcmBatch } from '@/lib/firebase-admin'
import { verifyCronSecret } from '@/lib/security'
import { londonDateISO, londonWeekday } from '@/lib/dates'
import { getSlotsDueForReminder } from '@/lib/timetable/timetableUtils'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const now = new Date()
  const todayISO = londonDateISO(now)
  const weekday = londonWeekday(now)

  const { data: todaysSlots } = await admin
    .from('timetable_slots')
    .select('id, year_group, title, start_time, end_time, location, day_of_week')
    .eq('day_of_week', weekday)

  if (!todaysSlots?.length) return NextResponse.json({ sent: 0, slots: 0 })

  const dueSlots = getSlotsDueForReminder(todaysSlots, now, todayISO)
  if (!dueSlots.length) return NextResponse.json({ sent: 0, slots: 0 })

  const { data: alreadySent } = await admin
    .from('timetable_reminder_log')
    .select('slot_id')
    .eq('session_date', todayISO)
    .in('slot_id', dueSlots.map(s => s.id))

  const alreadySentIds = new Set((alreadySent ?? []).map(r => r.slot_id))
  const pendingSlots = dueSlots.filter(s => !alreadySentIds.has(s.id))
  if (!pendingSlots.length) return NextResponse.json({ sent: 0, slots: 0 })

  let totalWebSent = 0
  let totalFcmSent = 0

  for (const slot of pendingSlots) {
    const { data: students } = await admin
      .from('users')
      .select('id')
      .eq('role', 'student')
      .eq('year_group', slot.year_group)
    const studentIds = (students ?? []).map(s => s.id)

    if (studentIds.length > 0) {
      const { data: subs } = await admin
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth')
        .in('user_id', studentIds)
      const { data: nativeTokens } = await admin
        .from('native_push_tokens')
        .select('token')
        .in('user_id', studentIds)
      const tokens = (nativeTokens ?? []).map(r => r.token as string)

      const payload = {
        title: `⏰ ${slot.title} in 15 mins`,
        body: [slot.location, `starts ${slot.start_time.slice(0, 5)}`].filter(Boolean).join(' · '),
        url: '/timetable',
      }

      const webResults = await Promise.allSettled(
        (subs ?? []).map(s => sendPushNotification({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, payload))
      )
      totalWebSent += webResults.filter(r => r.status === 'fulfilled').length

      const deadEndpoints = webResults
        .map((r, i) =>
          r.status === 'rejected' &&
          [404, 410].includes((r.reason as { statusCode?: number } | undefined)?.statusCode ?? 0)
            ? (subs ?? [])[i]?.endpoint
            : null
        )
        .filter((e): e is string => typeof e === 'string')
      if (deadEndpoints.length > 0) {
        await admin.from('push_subscriptions').delete().in('endpoint', deadEndpoints)
      }

      if (tokens.length > 0) {
        const fcmResult = await sendFcmBatch(tokens, payload)
        totalFcmSent += fcmResult.sent
      }
    }

    await admin.from('timetable_reminder_log').insert({ slot_id: slot.id, session_date: todayISO })
  }

  return NextResponse.json({ sent: totalWebSent + totalFcmSent, slots: pendingSlots.length })
}
```

Add to `vercel.json`'s `crons` array (append as the last entry):

```json
    {
      "path": "/api/cron/timetable-reminders",
      "schedule": "*/5 6-18 * * 1-5"
    }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest __tests__/lib/timetable/timetableRemindersRoute.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: PASS — every test file in the project, including all the new ones from Tasks 2–10.

- [ ] **Step 6: Commit**

```bash
git add app/api/cron/timetable-reminders vercel.json __tests__/lib/timetable/timetableRemindersRoute.test.ts
git commit -m "feat: add 15-minute-before push reminder cron for timetable sessions

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

## Post-implementation checklist

- [ ] All 10 tasks committed.
- [ ] `npm test` passes in full.
- [ ] `npx tsc --noEmit` passes with no new errors.
- [ ] Migration applied to the live Supabase project (Task 1, Step 2) — the feature does nothing until this is done.
- [ ] At least one real timetable slot entered via `/admin/timetable` for each of the photographed sessions (Monday–Friday, skipping Wednesday).
- [ ] `CRON_SECRET`, VAPID and Firebase env vars already exist in Vercel (they do — reused from `calendar-reminders`/`session-reminders`) — no new env vars needed for this feature.
