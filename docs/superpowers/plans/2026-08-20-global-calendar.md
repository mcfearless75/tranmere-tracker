# Global Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admin/coach/teacher add one-off calendar events (title, date, optional time, description) that every role — students, parents, staff — sees on their own calendar page, with a push notification the day before, sent to everyone.

**Architecture:** One new `calendar_events` table, read by three role-specific calendar pages (student `/calendar` extended, new `/parent/calendar`, new `/admin/calendar` for management) and written by two new staff-only API routes. A new daily cron finds events happening tomorrow and pushes everyone (web + native).

**Tech Stack:** Next.js 14 App Router, Supabase (Postgres + RLS), `web-push` / Firebase Admin (already wired), Jest + Testing Library, Tailwind.

## Global Constraints

- Supabase project ref: `avpdwutgtsurddvfxhmh` (name: `tranmeretracker`)
- Staff role check uses the existing `requireStaff()` helper from `lib/auth/requireRole.ts` — do not write a new inline role-check
- API routes and page/cron logic are **not** unit-tested, matching this codebase's existing convention (zero API-route test coverage anywhere in the project today). Only `lib/` pure functions and `components/` get Jest tests.
- All new/changed files must pass `npx next lint` and `npx tsc --noEmit -p .` (pre-existing Jest-global errors in `*.test.ts(x)` files under a bare `tsc` run are known and not caused by this work — see Task 2 Step 4 for how to confirm that).
- Every new cron route must be added to `vercel.json` in the same commit it is created (Task 9).
- Reuse `londonHour()` / `londonDateISO()` from `lib/dates.ts` for any London-time logic — never `new Date().getHours()` or `.toISOString()` for "what day/hour is it in London".

---

### Task 1: Database migration — `calendar_events` table + RLS

**Files:**
- Create: `supabase/migrations/043_calendar_events.sql`

**Interfaces:**
- Produces: table `calendar_events(id uuid, title text, event_date date, event_time time nullable, description text nullable, created_by uuid, created_at timestamptz, updated_at timestamptz, reminder_sent_at timestamptz nullable)`, readable by any authenticated user, writable only by admin/coach/teacher.

- [ ] **Step 1: Write the migration file**

```sql
-- 043_calendar_events.sql
-- Run in Supabase Dashboard → SQL Editor (or via the Supabase MCP apply_migration tool)
--
-- Global calendar: admin/coach/teacher add one-off events (trips, parents'
-- evenings, kit collection days) that every role sees. reminder_sent_at is
-- an idempotency marker so the day-before reminder cron (see
-- app/api/cron/calendar-reminders) can never double-send for the same event,
-- even across its two DST-safe scheduled invocations.

create table if not exists calendar_events (
  id                uuid primary key default uuid_generate_v4(),
  title             text not null,
  event_date        date not null,
  event_time        time,
  description       text,
  created_by        uuid not null references public.users(id),
  created_at        timestamptz default now(),
  updated_at        timestamptz default now(),
  reminder_sent_at  timestamptz
);

alter table calendar_events enable row level security;

-- Staff manage (all commands) — matches match_events' pattern
create policy "staff can manage calendar_events"
  on calendar_events for all
  using (
    exists (
      select 1 from public.users
      where id = auth.uid()
      and role in ('admin', 'coach', 'teacher')
    )
  );

-- Everyone can read — non-sensitive academy info, every role sees it
create policy "everyone can read calendar_events"
  on calendar_events for select
  using (true);

-- Verification (run separately):
--
-- 1. Table + RLS enabled (should return 1 row, rowsecurity = true):
--   SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'calendar_events';
--
-- 2. Both policies exist (should return 2 rows):
--   SELECT policyname, cmd FROM pg_policies WHERE tablename = 'calendar_events';
```

- [ ] **Step 2: Apply the migration**

If Supabase MCP tools are available in this session, load them and apply directly:

```
ToolSearch: "select:mcp__d410daf9-4dcd-4083-8231-301c292286b1__apply_migration,mcp__d410daf9-4dcd-4083-8231-301c292286b1__execute_sql"
```

Then call `apply_migration` with `project_id: "avpdwutgtsurddvfxhmh"`, `name: "calendar_events"`, and `query` set to the full SQL from Step 1 (the `create table` / RLS statements — not the verification comments).

If Supabase MCP tools are not available, tell the user to run the file's contents in the Supabase Dashboard → SQL Editor for project `avpdwutgtsurddvfxhmh`.

- [ ] **Step 3: Verify**

Run the two verification queries from the end of the migration file via `execute_sql` (or the SQL Editor). Expected:
1. One row, `rowsecurity = true`
2. Two rows: `staff can manage calendar_events` (cmd `ALL`), `everyone can read calendar_events` (cmd `SELECT`)

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/043_calendar_events.sql
git commit -m "feat: calendar_events table + RLS for the global calendar feature"
```

---

### Task 2: Extend `calendarUtils.ts` for the new event type (TDD)

**Files:**
- Modify: `lib/calendar/calendarUtils.ts`
- Test: `__tests__/lib/calendar/calendarUtils.test.ts`

**Interfaces:**
- Consumes: nothing new
- Produces:
  - `CalendarEventRow = { id: string; title: string; event_date: string; event_time: string | null; description: string | null }`
  - `CalendarEvent['type']` now includes `'event'`; `CalendarEvent` gains optional `time?: string` and `description?: string`
  - `formatEventTime(time: string): string` — e.g. `'18:30:00'` → `'6:30pm'`, `'09:00:00'` → `'9am'`
  - `getCalendarEvents(sessions, matches, assignments, calendarEvents: CalendarEventRow[] = [])` — 4th param is optional and defaults to `[]`, so every existing 3-arg call site (student `/calendar` page today, and every existing test) keeps working unchanged until Task 5 updates the page

- [ ] **Step 1: Write the failing tests**

Add to the end of `__tests__/lib/calendar/calendarUtils.test.ts` (after the closing `})` of the `groupEventsByDate` describe block):

```ts
describe('formatEventTime', () => {
  it('formats a morning time without minutes', () => {
    expect(formatEventTime('09:00:00')).toBe('9am')
  })

  it('formats an afternoon time with minutes', () => {
    expect(formatEventTime('18:30:00')).toBe('6:30pm')
  })

  it('formats midday as 12pm', () => {
    expect(formatEventTime('12:00:00')).toBe('12pm')
  })

  it('formats midnight as 12am', () => {
    expect(formatEventTime('00:00:00')).toBe('12am')
  })

  it('handles an HH:MM string with no seconds', () => {
    expect(formatEventTime('06:05')).toBe('6:05am')
  })
})

describe('getCalendarEvents — calendar_events', () => {
  it('maps calendar_events rows to event-type entries', () => {
    const calendarEvents = [
      { id: '1', title: 'Kit collection day', event_date: '2024-06-12', event_time: null, description: null },
    ]
    const result = getCalendarEvents([], [], [], calendarEvents)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject<CalendarEvent>({
      date: '2024-06-12',
      label: 'Kit collection day',
      type: 'event',
    })
  })

  it('includes a formatted time when event_time is set', () => {
    const calendarEvents = [
      { id: '1', title: "Parents' evening", event_date: '2024-06-12', event_time: '18:30:00', description: null },
    ]
    const result = getCalendarEvents([], [], [], calendarEvents)
    expect(result[0].time).toBe('6:30pm')
  })

  it('omits time when event_time is null', () => {
    const calendarEvents = [
      { id: '1', title: 'Trip', event_date: '2024-06-12', event_time: null, description: null },
    ]
    const result = getCalendarEvents([], [], [], calendarEvents)
    expect(result[0].time).toBeUndefined()
  })

  it('includes description when set, omits when null', () => {
    const withDesc = getCalendarEvents([], [], [], [
      { id: '1', title: 'Trip', event_date: '2024-06-12', event_time: null, description: 'Meet at reception 8am' },
    ])
    expect(withDesc[0].description).toBe('Meet at reception 8am')

    const withoutDesc = getCalendarEvents([], [], [], [
      { id: '1', title: 'Trip', event_date: '2024-06-12', event_time: null, description: null },
    ])
    expect(withoutDesc[0].description).toBeUndefined()
  })

  it('defaults the 4th argument to an empty array — existing 3-arg calls still work', () => {
    const result = getCalendarEvents([], [], [])
    expect(result).toHaveLength(0)
  })

  it('combines calendar events with the other three types', () => {
    const sessions = [{ scheduled_date: '2024-06-10', session_label: 'AM Session', session_type: 'training', opens_at: '2024-06-10T09:00:00Z', closes_at: null }]
    const matches = [{ match_date: '2024-06-15', opponent: 'Wrexham', location: 'Away' }]
    const assignments = [{ due_date: '2024-06-20', title: 'Essay' }]
    const calendarEvents = [{ id: '1', title: 'Trip', event_date: '2024-06-25', event_time: null, description: null }]
    const result = getCalendarEvents(sessions, matches, assignments, calendarEvents)
    expect(result).toHaveLength(4)
    expect(result.map(e => e.type)).toEqual(['session', 'match', 'deadline', 'event'])
  })
})
```

Update the top import to include the new names:

```ts
import {
  getDaysInMonth,
  getCalendarEvents,
  groupEventsByDate,
  formatEventTime,
  type CalendarEvent,
} from '@/lib/calendar/calendarUtils'
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/lib/calendar/calendarUtils.test.ts`
Expected: FAIL — `formatEventTime` is not exported, `getCalendarEvents` only accepts 3 args, `'event'` is not assignable to `CalendarEvent['type']`.

- [ ] **Step 3: Implement**

Replace the full contents of `lib/calendar/calendarUtils.ts` with:

```ts
export type CalendarEvent = {
  date: string // YYYY-MM-DD
  label: string
  type: 'session' | 'match' | 'deadline' | 'event'
  time?: string
  description?: string
}

export type AttendanceSessionRow = {
  scheduled_date: string
  session_label: string
  session_type: string
  opens_at: string
  closes_at: string | null
}

export type MatchEventRow = {
  match_date: string
  opponent: string
  location: string | null
}

export type AssignmentRow = {
  due_date: string
  title: string
}

export type CalendarEventRow = {
  id: string
  title: string
  event_date: string
  event_time: string | null
  description: string | null
}

/**
 * Returns the number of days in a given month.
 * @param year  Full year, e.g. 2024
 * @param month 1-based month, e.g. 1 = January
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

/**
 * Formats a Postgres 'HH:MM' or 'HH:MM:SS' time string as a friendly
 * 12-hour label, e.g. '18:30:00' -> '6:30pm', '09:00:00' -> '9am'.
 */
export function formatEventTime(time: string): string {
  const [hStr, mStr] = time.split(':')
  const h = Number(hStr)
  const m = Number(mStr)
  const period = h < 12 ? 'am' : 'pm'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return m === 0 ? `${h12}${period}` : `${h12}:${String(m).padStart(2, '0')}${period}`
}

/**
 * Converts raw Supabase rows into a flat CalendarEvent array.
 */
export function getCalendarEvents(
  sessions: AttendanceSessionRow[],
  matches: MatchEventRow[],
  assignments: AssignmentRow[],
  calendarEvents: CalendarEventRow[] = [],
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

  return [...sessionEvents, ...matchEvents, ...deadlineEvents, ...customEvents]
}

/**
 * Groups a flat CalendarEvent array by date string (YYYY-MM-DD).
 */
export function groupEventsByDate(
  events: CalendarEvent[],
): Record<string, CalendarEvent[]> {
  return events.reduce<Record<string, CalendarEvent[]>>((acc, event) => {
    if (!acc[event.date]) {
      acc[event.date] = []
    }
    acc[event.date].push(event)
    return acc
  }, {})
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/lib/calendar/calendarUtils.test.ts`
Expected: PASS, all tests (existing + new) green.

- [ ] **Step 5: Commit**

```bash
git add lib/calendar/calendarUtils.ts __tests__/lib/calendar/calendarUtils.test.ts
git commit -m "feat: add event type + formatEventTime to calendarUtils"
```

---

### Task 3: Extend `CalendarGrid.tsx` to render the new event type (TDD)

**Files:**
- Modify: `components/calendar/CalendarGrid.tsx`
- Test: Create `__tests__/components/calendar/CalendarGrid.test.tsx`

**Interfaces:**
- Consumes: `CalendarEvent` (with `type: 'event'`, optional `time`/`description`) from Task 2
- Produces: no new exports — same `CalendarGrid` component, now rendering a 4th event type

- [ ] **Step 1: Write the failing test**

Create `__tests__/components/calendar/CalendarGrid.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { CalendarGrid } from '@/components/calendar/CalendarGrid'
import type { CalendarEvent } from '@/lib/calendar/calendarUtils'

describe('CalendarGrid — event type', () => {
  const events: CalendarEvent[] = [
    { date: '2024-06-12', label: "Parents' evening", type: 'event', time: '6:30pm', description: 'Main hall' },
  ]

  it('shows the event in the legend', () => {
    render(<CalendarGrid events={events} initialYear={2024} initialMonth={6} />)
    expect(screen.getByText('Event')).toBeInTheDocument()
  })

  it('shows the event, its time and description in the day panel when the day is selected', () => {
    render(<CalendarGrid events={events} initialYear={2024} initialMonth={6} />)
    fireEvent.click(screen.getByRole('button', { name: /12.*1 event/i }))
    expect(screen.getByText("Parents' evening")).toBeInTheDocument()
    expect(screen.getByText('6:30pm')).toBeInTheDocument()
    expect(screen.getByText('Main hall')).toBeInTheDocument()
  })

  it('does not show time/description text for a day with no events selected', () => {
    render(<CalendarGrid events={events} initialYear={2024} initialMonth={6} />)
    expect(screen.queryByText('Main hall')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/components/calendar/CalendarGrid.test.tsx`
Expected: FAIL — `DOT_COLOUR`/`EVENT_BADGE`/`TYPE_LABEL` are `Record<CalendarEvent['type'], string>` and don't have an `event` key yet, so this is a TypeScript error at minimum, and 'Event' text won't render.

- [ ] **Step 3: Implement**

In `components/calendar/CalendarGrid.tsx`, update the three lookup records (note: `tranmere-gold` in `tailwind.config.ts` is a single flat colour with no `-100`/`-500`/`-800` shade scale, so `amber` — Tailwind's standard scale closest to the brand gold — is used instead, matching how `session`/`match`/`deadline` already use standard Tailwind scales rather than custom brand colours):

```ts
const DOT_COLOUR: Record<CalendarEvent['type'], string> = {
  session: 'bg-blue-500',
  match: 'bg-green-500',
  deadline: 'bg-red-500',
  event: 'bg-amber-500',
}

const EVENT_BADGE: Record<CalendarEvent['type'], string> = {
  session: 'bg-blue-100 text-blue-800 border-blue-200',
  match: 'bg-green-100 text-green-800 border-green-200',
  deadline: 'bg-red-100 text-red-800 border-red-200',
  event: 'bg-amber-100 text-amber-800 border-amber-200',
}

const TYPE_LABEL: Record<CalendarEvent['type'], string> = {
  session: 'Session',
  match: 'Match',
  deadline: 'Deadline',
  event: 'Event',
}
```

Add the `hasEvent` day-dot, right after the existing `hasDeadline` line inside the day-cell `.map()`:

```ts
          const hasSession = dayEvents.some(e => e.type === 'session')
          const hasMatch = dayEvents.some(e => e.type === 'match')
          const hasDeadline = dayEvents.some(e => e.type === 'deadline')
          const hasEvent = dayEvents.some(e => e.type === 'event')
```

Add the matching dot in the "Event dots" block, right after the `hasDeadline` dot:

```tsx
                  {hasDeadline && (
                    <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-red-200' : 'bg-red-500'}`} />
                  )}
                  {hasEvent && (
                    <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-amber-200' : 'bg-amber-500'}`} />
                  )}
```

Replace the day-panel event row (inside `selectedEvents.map(...)`) to show time/description when present:

```tsx
              {selectedEvents.map((event, i) => (
                <div
                  key={i}
                  className={`rounded-lg border px-3 py-2 text-sm ${EVENT_BADGE[event.type]}`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${DOT_COLOUR[event.type]}`} />
                    <span className="flex-1 font-medium">{event.label}</span>
                    <span className="text-xs font-semibold uppercase tracking-wide opacity-70">
                      {TYPE_LABEL[event.type]}
                    </span>
                  </div>
                  {event.time && (
                    <p className="text-xs mt-1 ml-4 opacity-80">{event.time}</p>
                  )}
                  {event.description && (
                    <p className="text-xs mt-1 ml-4 opacity-70">{event.description}</p>
                  )}
                </div>
              ))}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/components/calendar/CalendarGrid.test.tsx`
Expected: PASS, all 3 new tests green.

- [ ] **Step 5: Run the full calendar test suite to check nothing regressed**

Run: `npx jest __tests__/lib/calendar __tests__/components/calendar`
Expected: PASS, all tests green (existing session/match/deadline rendering is unchanged).

- [ ] **Step 6: Commit**

```bash
git add components/calendar/CalendarGrid.tsx __tests__/components/calendar/CalendarGrid.test.tsx
git commit -m "feat: render the new event type in CalendarGrid"
```

---

### Task 4: Staff API routes — create, edit, delete a calendar event

**Files:**
- Create: `app/api/admin/calendar-events/route.ts`
- Create: `app/api/admin/calendar-events/[eventId]/route.ts`

**Interfaces:**
- Consumes: `requireStaff()` from `lib/auth/requireRole.ts` (already exists — returns `{ ok: true, ctx: { user, role, admin } }` or `{ ok: false, response: NextResponse }`)
- Produces: `POST /api/admin/calendar-events` (body `{ title, event_date, event_time?, description? }` → `{ event }` or `{ error }`), `PATCH /api/admin/calendar-events/[eventId]` (same body → `{ ok: true }` or `{ error }`), `DELETE /api/admin/calendar-events/[eventId]` (no body → `{ ok: true }` or `{ error }`)

No automated test for this task — matches this project's existing convention (zero API-route Jest coverage anywhere in the codebase; `requireStaff()` itself already encapsulates the tested/trusted role-check logic). Verified manually in Step 3.

- [ ] **Step 1: Write the create route**

Create `app/api/admin/calendar-events/route.ts`:

```ts
import { requireStaff } from '@/lib/auth/requireRole'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const auth = await requireStaff()
  if (!auth.ok) return auth.response
  const { user, admin } = auth.ctx

  const body = await request.json()
  const { title, event_date, event_time, description } = body as {
    title?: string
    event_date?: string
    event_time?: string | null
    description?: string | null
  }

  if (!title?.trim()) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }
  if (!event_date || !/^\d{4}-\d{2}-\d{2}$/.test(event_date)) {
    return NextResponse.json({ error: 'event_date must be YYYY-MM-DD' }, { status: 400 })
  }

  const { data, error } = await admin
    .from('calendar_events')
    .insert({
      title: title.trim(),
      event_date,
      event_time: event_time || null,
      description: description?.trim() || null,
      created_by: user.id,
    })
    .select('id, title, event_date, event_time, description, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ event: data })
}
```

- [ ] **Step 2: Write the edit/delete route**

Create `app/api/admin/calendar-events/[eventId]/route.ts`:

```ts
import { requireStaff } from '@/lib/auth/requireRole'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  const auth = await requireStaff()
  if (!auth.ok) return auth.response
  const { admin } = auth.ctx

  const body = await request.json()
  const { title, event_date, event_time, description } = body as {
    title?: string
    event_date?: string
    event_time?: string | null
    description?: string | null
  }

  if (!title?.trim()) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }
  if (!event_date || !/^\d{4}-\d{2}-\d{2}$/.test(event_date)) {
    return NextResponse.json({ error: 'event_date must be YYYY-MM-DD' }, { status: 400 })
  }

  const { error } = await admin
    .from('calendar_events')
    .update({
      title: title.trim(),
      event_date,
      event_time: event_time || null,
      description: description?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.eventId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  const auth = await requireStaff()
  if (!auth.ok) return auth.response
  const { admin } = auth.ctx

  const { error } = await admin.from('calendar_events').delete().eq('id', params.eventId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Manually verify**

Run `npm run build` to confirm both routes compile as valid Next.js route handlers (this catches signature mistakes — e.g. a wrong `params` shape — even without a runtime test). Full end-to-end verification (as a logged-in admin/coach/teacher) happens naturally in Task 6 once the admin UI calls these routes.

- [ ] **Step 4: Commit**

```bash
git add "app/api/admin/calendar-events"
git commit -m "feat: staff API routes to create, edit and delete calendar events"
```

---

### Task 5: Wire calendar events into the student `/calendar` page

**Files:**
- Modify: `app/(student)/calendar/page.tsx`

**Interfaces:**
- Consumes: `getCalendarEvents(sessions, matches, assignments, calendarEvents)` from Task 2, `CalendarGrid` (unchanged props)

No automated test — this is a server component page, matching the existing convention (the student `/calendar` page has no test today either).

- [ ] **Step 1: Add the calendar_events fetch**

In `app/(student)/calendar/page.tsx`, add `calendar_events` as a 4th parallel query and pass it through:

```ts
  const [
    { data: sessions },
    { data: matches },
    { data: assignments },
    { data: calendarEvents },
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
  ])

  const events = getCalendarEvents(
    sessions  ?? [],
    matches   ?? [],
    assignments ?? [],
    calendarEvents ?? [],
  )
```

Add a 4th legend entry, right after the existing "Assignment deadline" one:

```tsx
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500 shrink-0" />
            <span>Assignment deadline</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-amber-500 shrink-0" />
            <span>Event</span>
          </div>
```

(Note: the legend grid is `grid-cols-3` — leave it as-is; a 4th item wraps to its own row, which is fine and matches how the grid already handles non-multiple-of-3 counts.)

- [ ] **Step 2: Manually verify**

Run `npx tsc --noEmit -p . 2>&1 | grep "app/(student)/calendar"` — expect no output (no type errors introduced). Run `npm run build` — expect a clean build.

- [ ] **Step 3: Commit**

```bash
git add "app/(student)/calendar/page.tsx"
git commit -m "feat: show calendar_events on the student calendar page"
```

---

### Task 6: Admin calendar management page (`/admin/calendar`)

**Files:**
- Create: `app/(admin)/admin/calendar/page.tsx`
- Create: `app/(admin)/admin/calendar/CalendarEventsManager.tsx`
- Modify: `components/layout/AdminSidebar.tsx`
- Modify: `components/layout/MobileAdminBar.tsx`

**Interfaces:**
- Consumes: `POST /api/admin/calendar-events`, `PATCH /api/admin/calendar-events/[eventId]`, `DELETE /api/admin/calendar-events/[eventId]` (Task 4), `formatEventTime` (Task 2)
- Produces: no exports consumed elsewhere

No automated test — matches the existing convention (`CreateBroadcastForm.tsx`, the component this most closely follows, has no test either).

- [ ] **Step 1: Write the manager client component**

Create `app/(admin)/admin/calendar/CalendarEventsManager.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarPlus, Pencil, Trash2 } from 'lucide-react'
import { formatEventTime, type CalendarEventRow } from '@/lib/calendar/calendarUtils'

type Props = { events: CalendarEventRow[] }

const EMPTY_FORM = { title: '', event_date: '', event_time: '', description: '' }

export function CalendarEventsManager({ events }: Props) {
  const router = useRouter()
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function startEdit(event: CalendarEventRow) {
    setEditingId(event.id)
    setForm({
      title: event.title,
      event_date: event.event_date,
      event_time: event.event_time?.slice(0, 5) ?? '',
      description: event.description ?? '',
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || !form.event_date) return
    setLoading(true)
    const body = {
      title: form.title.trim(),
      event_date: form.event_date,
      event_time: form.event_time || null,
      description: form.description.trim() || null,
    }
    const res = await fetch(
      editingId ? `/api/admin/calendar-events/${editingId}` : '/api/admin/calendar-events',
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
      alert(data.error ?? 'Failed to save event')
    }
  }

  async function remove(id: string, title: string) {
    if (!confirm(`Delete "${title}"?`)) return
    const res = await fetch(`/api/admin/calendar-events/${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (res.ok) {
      if (editingId === id) cancelEdit()
      router.refresh()
    } else {
      alert(data.error ?? 'Failed to delete event')
    }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={submit} className="rounded-2xl border bg-white p-4 space-y-3 shadow-sm">
        <p className="text-sm font-semibold text-tranmere-blue">
          {editingId ? 'Edit event' : 'Add event'}
        </p>
        <input
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          placeholder="Title, e.g. Kit collection day"
          className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-tranmere-blue outline-none"
          required
        />
        <div className="flex gap-2">
          <input
            type="date"
            value={form.event_date}
            onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))}
            className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-tranmere-blue outline-none"
            required
          />
          <input
            type="time"
            value={form.event_time}
            onChange={e => setForm(f => ({ ...f, event_time: e.target.value }))}
            className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-tranmere-blue outline-none"
          />
        </div>
        <textarea
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder="Description (optional)"
          rows={2}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-tranmere-blue outline-none"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={!form.title.trim() || !form.event_date || loading}
            className="flex items-center gap-1.5 bg-tranmere-blue text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-blue-900 transition-colors"
          >
            <CalendarPlus size={15} />
            {loading ? 'Saving…' : editingId ? 'Save changes' : 'Add event'}
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
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No upcoming events.</p>
        ) : (
          events.map(event => (
            <div key={event.id} className="flex items-start gap-3 rounded-xl border bg-white p-3 shadow-sm">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-tranmere-blue">
                  {new Date(event.event_date + 'T12:00:00').toLocaleDateString('en-GB', {
                    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
                  })}
                  {event.event_time && ` · ${formatEventTime(event.event_time)}`}
                </p>
                <p className="text-sm font-medium truncate">{event.title}</p>
                {event.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => startEdit(event)}
                  aria-label={`Edit ${event.title}`}
                  className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => remove(event.id, event.title)}
                  aria-label={`Delete ${event.title}`}
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

- [ ] **Step 2: Write the page**

Create `app/(admin)/admin/calendar/page.tsx`:

```tsx
import { createAdminClient } from '@/lib/supabase/admin'
import { CalendarEventsManager } from './CalendarEventsManager'

export const dynamic = 'force-dynamic'

export default async function AdminCalendarPage() {
  const supabase = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  const { data: events } = await supabase
    .from('calendar_events')
    .select('id, title, event_date, event_time, description')
    .gte('event_date', today)
    .order('event_date', { ascending: true })
    .order('event_time', { ascending: true, nullsFirst: true })

  return (
    <div className="space-y-4">
      <div className="py-2">
        <h1 className="text-lg font-bold text-tranmere-blue">Calendar</h1>
        <p className="text-xs text-muted-foreground">
          Add events for every player, parent and staff member to see
        </p>
      </div>
      <CalendarEventsManager events={events ?? []} />
    </div>
  )
}
```

- [ ] **Step 3: Add the nav link to `AdminSidebar.tsx`**

In `components/layout/AdminSidebar.tsx`, add `CalendarDays` to the lucide-react import:

```ts
import { Users, Bell, BarChart2, GraduationCap, LogOut, Calendar, CalendarDays, Wifi, Activity, LayoutGrid, Plug, MessageSquare, Megaphone, Home, ClipboardList, ShieldAlert, Network, UserPlus, Users2, Banknote } from 'lucide-react'
```

Add a new nav entry right after `Dashboard`:

```ts
const nav = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: Home },
  { href: '/admin/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/admin/users', label: 'Users', icon: Users },
  ...
```

(leave every other existing entry unchanged)

- [ ] **Step 4: Add the same nav link to `MobileAdminBar.tsx`**

In `components/layout/MobileAdminBar.tsx`, add `CalendarDays` to the lucide-react import (same line shape as Step 3), and add the identical `{ href: '/admin/calendar', label: 'Calendar', icon: CalendarDays }` entry right after `Dashboard` in its own `nav` array.

- [ ] **Step 5: Manually verify**

Run `npm run build` — expect a clean build with a new `/admin/calendar` route in the output. Run `npx next lint` — expect no new errors.

- [ ] **Step 6: Commit**

```bash
git add "app/(admin)/admin/calendar" components/layout/AdminSidebar.tsx components/layout/MobileAdminBar.tsx
git commit -m "feat: admin calendar event management page"
```

---

### Task 7: Add push opt-in to the parent dashboard

**Files:**
- Modify: `app/(parent)/parent/dashboard/page.tsx`

**Interfaces:**
- Consumes: `PushOptIn` from `components/PushOptIn.tsx` (already exists, unchanged)

No automated test — matches the existing convention (the student/admin dashboards that already render `<PushOptIn />` have no test covering that either).

- [ ] **Step 1: Add the import and render it**

In `app/(parent)/parent/dashboard/page.tsx`, add the import alongside the existing ones at the top:

```ts
import { PushOptIn } from '@/components/PushOptIn'
```

Add `<PushOptIn />` at the end of the returned JSX, right after the `.map()` closes and before the closing `</div>`:

```tsx
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-tranmere-blue">Overview</h1>
      {studentsData.map(student => (
        <StudentOverviewCard key={student.id} student={student} />
      ))}
      <PushOptIn />
    </div>
  )
}
```

- [ ] **Step 2: Manually verify**

Run `npm run build` — expect a clean build. `PushOptIn` is a client component with no props, so this is a purely mechanical, low-risk addition — no new logic to verify beyond the build succeeding.

- [ ] **Step 3: Commit**

```bash
git add "app/(parent)/parent/dashboard/page.tsx"
git commit -m "feat: add push notification opt-in to the parent dashboard"
```

---

### Task 8: Parent calendar page (`/parent/calendar`)

**Files:**
- Create: `app/(parent)/parent/calendar/page.tsx`
- Modify: `components/layout/ParentSidebar.tsx`
- Modify: `components/layout/MobileParentBar.tsx`

**Interfaces:**
- Consumes: `getCalendarEvents`, `MatchEventRow`, `CalendarEvent` (Task 2), `CalendarGrid` (Task 3)

No automated test — matches the existing convention (`parent/matches/page.tsx`, this page's closest sibling, has no test either).

- [ ] **Step 1: Write the page**

Create `app/(parent)/parent/calendar/page.tsx`:

```tsx
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { CalendarGrid } from '@/components/calendar/CalendarGrid'
import { getCalendarEvents, type MatchEventRow } from '@/lib/calendar/calendarUtils'

export const dynamic = 'force-dynamic'

interface MatchSquadRow {
  match_events: { match_date: string; opponent: string; location: string | null } | null
}

export default async function ParentCalendarPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: links } = await admin
    .from('parent_student_links')
    .select('student_id')
    .eq('parent_id', user.id)
  const studentIds = (links ?? []).map(l => l.student_id as string)

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1 // 1-based
  const windowStart = new Date(year, month - 2, 1).toISOString().split('T')[0]
  const windowEnd = new Date(year, month + 1, 0).toISOString().split('T')[0]

  const [{ data: squads }, { data: calendarEvents }] = await Promise.all([
    studentIds.length
      ? admin
          .from('match_squads')
          .select('match_events(match_date, opponent, location)')
          .in('player_id', studentIds)
          .not('match_events', 'is', null)
      : Promise.resolve({ data: [] as MatchSquadRow[] }),
    admin
      .from('calendar_events')
      .select('id, title, event_date, event_time, description')
      .gte('event_date', windowStart)
      .lte('event_date', windowEnd),
  ])

  const matches: MatchEventRow[] = ((squads ?? []) as unknown as MatchSquadRow[])
    .map(s => s.match_events)
    .filter((m): m is { match_date: string; opponent: string; location: string | null } => !!m)
    .filter(m => m.match_date >= windowStart && m.match_date <= windowEnd)

  const events = getCalendarEvents([], matches, [], calendarEvents ?? [])

  return (
    <div className="space-y-4">
      <div className="py-2">
        <h1 className="text-lg font-bold text-tranmere-blue">Calendar</h1>
        <p className="text-xs text-muted-foreground">Matches &amp; academy events</p>
      </div>
      <div className="rounded-2xl bg-white border border-gray-200 p-4 shadow-sm">
        <CalendarGrid events={events} initialYear={year} initialMonth={month} />
      </div>
      <div className="rounded-2xl bg-gray-50 border border-gray-200 p-4 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Key</p>
        <div className="grid grid-cols-2 gap-2 text-xs text-gray-700">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-500 shrink-0" />
            <span>Match</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-amber-500 shrink-0" />
            <span>Event</span>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add the nav link to `ParentSidebar.tsx`**

In `components/layout/ParentSidebar.tsx`, add `CalendarDays` to the lucide-react import:

```ts
import { Home, ClipboardList, GraduationCap, Calendar, CalendarDays, MessageSquare, Megaphone, LogOut } from 'lucide-react'
```

Add a new nav entry right after `Overview`:

```ts
const nav = [
  { href: '/parent/dashboard', label: 'Overview', icon: Home },
  { href: '/parent/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/parent/attendance', label: 'Attendance', icon: ClipboardList },
  ...
```

(leave every other existing entry unchanged)

- [ ] **Step 3: Add the same nav link to `MobileParentBar.tsx`**

In `components/layout/MobileParentBar.tsx`, add `CalendarDays` to the lucide-react import (same line shape as Step 2), and add the identical `{ href: '/parent/calendar', label: 'Calendar', icon: CalendarDays }` entry right after `Overview` in its `nav` array.

- [ ] **Step 4: Manually verify**

Run `npm run build` — expect a clean build with a new `/parent/calendar` route. Run `npx next lint` — expect no new errors.

- [ ] **Step 5: Commit**

```bash
git add "app/(parent)/parent/calendar" components/layout/ParentSidebar.tsx components/layout/MobileParentBar.tsx
git commit -m "feat: parent calendar page showing matches and academy events"
```

---

### Task 9: Day-before reminder cron

**Files:**
- Create: `app/api/cron/calendar-reminders/route.ts`
- Modify: `vercel.json`

**Interfaces:**
- Consumes: `createAdminClient` (`lib/supabase/admin.ts`), `sendPushNotification` (`lib/webpush.ts`), `sendFcmBatch` (`lib/firebase-admin.ts`), `verifyCronSecret` (`lib/security.ts`), `londonHour`/`londonDateISO` (`lib/dates.ts`) — all existing, unchanged

No automated test — matches the existing convention (`lunch-ending`, `session-reminders`, every other cron route, has no test either).

- [ ] **Step 1: Write the cron route**

Create `app/api/cron/calendar-reminders/route.ts`:

```ts
// Vercel Cron: daily "event tomorrow" reminder to EVERYONE (students, parents,
// staff) — always at 9am LONDON TIME, correctly through the BST/GMT clock
// change. Same DST-safe dual-schedule trick as lunch-ending: vercel.json fires
// this route twice, at 08:00 and 09:00 UTC (one covers BST, the other GMT);
// this handler checks the real London hour via Intl and only sends when it's
// actually 9, so exactly one of the two invocations does anything on any given
// day — self-correcting across the clock change with no manual schedule edit.

import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushNotification } from '@/lib/webpush'
import { sendFcmBatch } from '@/lib/firebase-admin'
import { verifyCronSecret } from '@/lib/security'
import { londonHour, londonDateISO } from '@/lib/dates'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  if (londonHour(now) !== 9) {
    return NextResponse.json({ skipped: true, reason: 'not 9am London time', londonHour: londonHour(now) })
  }

  const admin = createAdminClient()

  const tomorrow = new Date(now.getTime() + 24 * 60 * 60_000)
  const tomorrowISO = londonDateISO(tomorrow)

  const { data: events } = await admin
    .from('calendar_events')
    .select('id, title, event_time, description')
    .eq('event_date', tomorrowISO)
    .is('reminder_sent_at', null)

  if (!events?.length) return NextResponse.json({ sent: 0, events: 0 })

  // Audience is everyone who can see the calendar — no role filter.
  const { data: subs } = await admin.from('push_subscriptions').select('endpoint, p256dh, auth')
  const { data: nativeTokens } = await admin.from('native_push_tokens').select('token')
  const tokens = (nativeTokens ?? []).map(r => r.token as string)

  let totalWebSent = 0
  let totalFcmSent = 0

  for (const event of events) {
    const bodyParts: string[] = []
    if (event.event_time) bodyParts.push(event.event_time.slice(0, 5))
    if (event.description) bodyParts.push(event.description.slice(0, 80))
    const payload = {
      title: `📅 Tomorrow: ${event.title}`,
      body: bodyParts.join(' · ') || 'Tomorrow',
      url: '/dashboard',
    }

    const webResults = await Promise.allSettled(
      (subs ?? []).map(s => sendPushNotification({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, payload))
    )
    totalWebSent += webResults.filter(r => r.status === 'fulfilled').length

    // Prune dead subscriptions (404/410 = the browser revoked/expired it).
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

    // Idempotency: never re-send for this event, even if the cron re-runs.
    await admin.from('calendar_events').update({ reminder_sent_at: new Date().toISOString() }).eq('id', event.id)
  }

  return NextResponse.json({ sent: totalWebSent + totalFcmSent, events: events.length })
}
```

- [ ] **Step 2: Add the cron to `vercel.json`**

Add these two entries to the `crons` array in `vercel.json` (anywhere in the array — order doesn't matter to Vercel; append at the end, right after `schedule-reviews`):

```json
    {
      "path": "/api/cron/calendar-reminders",
      "schedule": "0 8 * * *"
    },
    {
      "path": "/api/cron/calendar-reminders",
      "schedule": "0 9 * * *"
    }
```

Remember: `08:00`/`09:00 UTC` = `09:00 London` in both BST (UTC+1, so 08:00 UTC) and GMT (UTC+0, so 09:00 UTC) — this is the same dual-schedule shape as the existing `lunch-ending` entries in the same file, just at a different hour.

- [ ] **Step 3: Manually verify**

Run `npm run build` — expect a clean build with the new `/api/cron/calendar-reminders` route in the output. Confirm `vercel.json` is valid JSON: `node -e "JSON.parse(require('fs').readFileSync('vercel.json'))"` — expect no output (no error thrown).

- [ ] **Step 4: Commit**

```bash
git add "app/api/cron/calendar-reminders" vercel.json
git commit -m "feat: day-before push reminder cron for calendar events"
```

---

## Final check (after all 9 tasks)

- [ ] Run the full test suite: `npx jest` — expect all suites passing (existing 636+ plus the new calendarUtils/CalendarGrid additions from Tasks 2–3)
- [ ] Run `npm run build` — expect a clean production build with `/calendar`, `/parent/calendar`, `/admin/calendar`, and `/api/cron/calendar-reminders` all present in the route output
- [ ] Run `npx next lint` — expect no new errors (pre-existing warnings unrelated to this feature are fine)
- [ ] Push the branch and open a PR, following this project's existing convention (see PRs #9–#20): direct against `master`, no long-lived branch
