# Global Calendar — Design

**Date:** 2026-08-20
**Status:** Approved, ready for implementation plan

## Problem

Admin/coach (and, per this design, teacher) need a way to add one-off events —
trips, parents' evenings, kit collection days, holidays — that every role
(students, parents, staff) can see on a calendar. Whoever can see an event
should get a push reminder the day before, the way Outlook reminds you of an
upcoming appointment.

Today's `/calendar` page (student-only in practice) auto-generates its
entries from `attendance_sessions`, `match_events`, and `assignments` — there
is no way for staff to add an arbitrary manual entry.

## Architecture

Three role-specific calendar pages, all reading from one shared
`calendar_events` table — **not** one universal page. Each role already has
its own layout that hard-redirects the "wrong" role away (`(student)` layout
bounces admin/coach/teacher to `/admin/dashboard`; `(parent)` layout
redirects anyone whose role isn't `parent` to `/login`). Building one
literal shared route would mean fighting that existing structure. Instead:

- **`/admin/calendar`** (new) — staff-only. Create, edit, delete events.
- **`/parent/calendar`** (new) — parents' own view: `calendar_events` +
  their linked student's `match_events`.
- **`/calendar`** (existing, extended) — students' view: adds
  `calendar_events` as a 4th source alongside sessions/matches/deadlines.
- **`app/api/cron/calendar-reminders`** (new) — daily cron, pushes everyone
  about tomorrow's events.
- **`<PushOptIn />` added to the parent dashboard** — currently only renders
  on the student and admin dashboards. Without this, "parents get reminded"
  silently reaches zero parents, since they have no way to opt in today.

Net effect: one shared data source, viewed through each role's existing UI.
Adding an event once makes it visible to everyone; it does not require a new
universal page or changes to the existing role-routing/layout structure.

## Data model

New migration `043_calendar_events.sql`:

```sql
create table calendar_events (
  id                uuid primary key default uuid_generate_v4(),
  title             text not null,
  event_date        date not null,
  event_time        time,              -- optional, e.g. "18:30"
  description       text,
  created_by        uuid not null references public.users(id),
  created_at        timestamptz default now(),
  updated_at        timestamptz default now(),
  reminder_sent_at  timestamptz        -- set once the day-before push fires,
                                        -- so a cron re-run (or the DST dual-
                                        -- schedule) can never double-send
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
```

Writes go through service-role API routes with the same inline role-check
every other staff route already uses
(`admin.from('users').select('role')...` → 403 if not
`admin`/`coach`/`teacher`). The RLS policy above is defense-in-depth, not the
primary gate — consistent with how `match_events`, `broadcast`, and every
other staff-write path in this app already works.

## Backend routes

- `POST /api/admin/calendar-events` — create. Staff-only.
- `PATCH /api/admin/calendar-events/[eventId]` — edit. Staff-only.
- `DELETE /api/admin/calendar-events/[eventId]` — delete. Staff-only.

All three follow the existing pattern exactly: `createClient()` for
`getUser()`, `createAdminClient()` for the role lookup and the actual
write, 401/403 on failure.

## Reminder cron

`app/api/cron/calendar-reminders/route.ts` — same DST-safe dual-schedule
trick as `lunch-ending`: `vercel.json` fires it at **8am and 9am UTC, every
day** (not weekday-only — events can land on a Saturday). The handler checks
`londonHour() === 9` via the existing `lib/dates.ts` helper and no-ops on
the other invocation, so exactly one send happens per calendar day
regardless of BST/GMT.

Logic:
1. Compute tomorrow's London date via `londonDateISO()`.
2. `select * from calendar_events where event_date = <tomorrow> and reminder_sent_at is null`.
3. For each event, push **everyone** — no role filter, since audience is
   everyone. Web push (`push_subscriptions`) + native (`native_push_tokens`),
   reusing `sendPushNotification` / `sendFcmBatch`, with the same
   404/410 dead-subscription pruning `lunch-ending` and `/api/push/send`
   already do.
4. Payload: title `📅 Tomorrow: {event.title}`, body = time (if set) +
   first ~80 chars of description, `url: '/dashboard'`. Middleware already
   redirects `/dashboard` to the right home per role (parents →
   `/parent/dashboard`, staff → `/admin/gps-dashboard`), so one push payload
   safely lands everyone somewhere sensible without per-role URLs.
5. Mark `reminder_sent_at = now()` on the event once its push attempt
   completes, so it is never re-sent.

`vercel.json` additions:

```json
{ "path": "/api/cron/calendar-reminders", "schedule": "0 8 * * *" },
{ "path": "/api/cron/calendar-reminders", "schedule": "0 9 * * *" }
```

## Frontend / UI

- **`lib/calendar/calendarUtils.ts`**: add `'event'` to the
  `CalendarEvent['type']` union; add optional `time?: string` and
  `description?: string` fields to `CalendarEvent`; extend
  `getCalendarEvents()` to accept a 4th `CalendarEventRow[]` array and map
  it the same way `sessions`/`matches`/`assignments` already are.
- **`components/calendar/CalendarGrid.tsx`**: add `event` to the
  `DOT_COLOUR` / `EVENT_BADGE` / `TYPE_LABEL` records — gold, to match the
  `tranmere-gold` brand colour already used for the push opt-in button;
  add the matching day-dot condition (`hasEvent`); show time + description
  in the day panel when present. All mechanical — follows the existing
  session/match/deadline pattern exactly, no structural change to the
  component.
- **Student `/calendar`** (`app/(student)/calendar/page.tsx`): add
  `calendar_events` as a 4th source in the existing `Promise.all` fetch.
- **New `/parent/calendar`**: same `CalendarGrid`, fed `calendar_events` +
  the parent's linked student's `match_events` (skips sessions/deadlines —
  not parent-relevant). Add a "Calendar" link to `ParentSidebar` and
  `MobileParentBar`.
- **New `/admin/calendar`**: chronological upcoming-events list, a create
  form (modal, same shape as `CreateBroadcastForm.tsx`), inline edit/delete
  per row. Add a nav link alongside the existing admin sections.
- **`app/(parent)/parent/dashboard/page.tsx`**: add `<PushOptIn />`,
  matching where it already sits on the student and admin dashboards.

## Testing

Matches the existing convention exactly: zero API routes have Jest coverage
anywhere in this codebase today — all testing is on `lib/` pure functions
and `components/`. This design does not change that pattern.

- Extend calendar utils test coverage for the new `'event'` type and the
  4th source array in `getCalendarEvents()`.
- New tests for `CalendarGrid` rendering an `event`-type entry (dot, badge,
  day-panel time/description).
- The cron route and the three API routes stay thin and untested, same as
  `lunch-ending`, `session-reminders`, and `broadcast` — verified live the
  same way the rest of the push notification work was (PRs #9, #16–#20).

## Out of scope (deliberately)

- Multi-day / date-range events (single day + optional time only, per
  approved design)
- Per-event target audience picker (reminder always goes to everyone who
  can see the calendar)
- Event categories / colour variety beyond the one new "event" type
- Recurring events
- A shared `requireStaff()` helper to de-duplicate the role-check
  boilerplate across routes — real gap (flagged in the July code sweep),
  but a cross-cutting refactor unrelated to this feature; not bundled in
  here.
