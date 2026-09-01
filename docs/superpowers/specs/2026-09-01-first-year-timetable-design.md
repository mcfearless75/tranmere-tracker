# 1st-Year Weekly Timetable + Session Reminders — Design

## Context

1st-year students' academic timetable (from the college's Moodle eILP dashboard) needs
to be visible inside Tranmere Tracker, with a push notification before each session.
Wednesdays have no timetable entries — that's match day.

The app already has related-but-distinct infrastructure:

- `calendar_events` — one-off, everyone-visible events with a day-before 9am reminder
  cron (`app/api/cron/calendar-reminders`).
- `schedule_templates` / `schedule_slots` — a weekly AM/PM template, but scoped to
  training/match/gym/lessons *attendance* sessions (QR/PIN check-in), not an academic
  timetable.
- `users.year_group` — already distinguishes 1st vs 2nd year students
  (`032_year_group.sql`).
- `app/api/cron/session-reminders` — an existing every-5-minutes cron that reminds
  students of an `attendance_sessions` row opening soon. Same shape of problem, different
  table.

This is a new, separate concept: a recurring weekly academic timetable, scoped by
`year_group`, with its own admin management UI, student view, calendar integration, and
reminder cron.

## Data model

### `timetable_slots`

Recurring weekly template. Admin edits it in place — no per-week rows, no versioning.

```sql
create table timetable_slots (
  id          uuid primary key default uuid_generate_v4(),
  year_group  smallint not null default 1 check (year_group in (1, 2)),
  day_of_week smallint not null check (day_of_week in (1, 2, 4, 5)), -- Mon,Tue,Thu,Fri — Wed excluded (match day)
  start_time  time not null,
  end_time    time not null check (end_time > start_time),
  title       text not null,
  location    text,
  tutor       text,
  created_by  uuid not null references public.users(id),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
```

RLS:
- Staff (`is_staff()`) manage all rows (all commands) — matches `calendar_events`' pattern.
- Students can `select` only rows where `year_group` matches their own
  (`exists (select 1 from public.users where id = auth.uid() and users.year_group = timetable_slots.year_group and role = 'student')`).
- No policy for `anon` — matches the recent bucket-scoping security fix's spirit of
  scoping reads tightly rather than defaulting open.

### `timetable_reminder_log`

Idempotency guard so the every-5-minutes cron can never double-send for the same slot on
the same day, even if two invocations overlap.

```sql
create table timetable_reminder_log (
  slot_id      uuid not null references timetable_slots(id) on delete cascade,
  session_date date not null,
  sent_at      timestamptz default now(),
  primary key (slot_id, session_date)
);
```

RLS enabled, staff-only policy (service-role cron bypasses RLS anyway; no client ever
needs to read this table).

## Admin management

- `app/(admin)/admin/timetable/page.tsx` — server component, fetches all
  `timetable_slots` ordered by `day_of_week, start_time`, renders `TimetableManager`.
- `components` (or colocated) `TimetableManager.tsx` — client component cloned from the
  existing `CalendarEventsManager` pattern: a form card (title, day-of-week select
  limited to Mon/Tue/Thu/Fri, start/end time, location, tutor) plus a list of existing
  slots grouped by day with edit/delete. `year_group` is not exposed in the v1 form — it
  is hardcoded to `1` on insert, since 2nd-years have no timetable yet (YAGNI; the column
  is ready for when they do).
- `app/api/admin/timetable-slots/route.ts` — `POST` create (staff only via
  `requireStaff()`).
- `app/api/admin/timetable-slots/[slotId]/route.ts` — `PATCH` update, `DELETE` remove.
- Nav: add a "Timetable" entry (reusing a calendar-style icon) to `AdminSidebar.tsx` and
  `MobileAdminBar.tsx`, right after "Calendar" — same treatment "Documents" got in the
  prior commit that added it to all role nav menus.

## Student view

- `app/(student)/timetable/page.tsx` — server component. Reads the viewer's
  `year_group`. If not `1`, renders a simple "No timetable yet" empty state rather than
  redirecting (direct navigation shouldn't be surprising). If `1`, fetches
  `timetable_slots` for `year_group = 1` and renders `TimetableGrid`.
- `components/timetable/TimetableGrid.tsx` — Monday–Friday, each day rendered as a
  card list of that day's sessions (time range, title, location, tutor), mobile-first
  (stacked cards, not a literal pixel timeline). Wednesday always renders a fixed
  "⚽ Match day — no timetable" card instead of an empty state.
- Nav: `BottomNav.tsx` and `SideNav.tsx` currently render a static nav array with no
  role/year-group awareness. Both gain an optional prop (`showTimetable: boolean`) so the
  "Timetable" link only appears for `year_group = 1` students. `app/(student)/layout.tsx`
  already fetches the user's `profile` row for the admin-redirect check — it gains
  `year_group` in that same `select()` and passes `showTimetable={profile?.year_group === 1}`
  down to both nav components.

## Calendar integration

- `lib/calendar/calendarUtils.ts`:
  - New `TimetableSlotRow` type (`day_of_week`, `start_time`, `end_time`, `title`,
    `location`).
  - New function `expandTimetableSlots(slots, windowStartISO, windowEndISO)` — pure
    function, walks each date in the window, matches slots by `day_of_week`, emits one
    `CalendarEvent` per (slot, date) occurrence.
  - `CalendarEvent['type']` gains `'class'`.
  - `getCalendarEvents(...)` gains a 5th param for the expanded timetable events.
- `app/(student)/calendar/page.tsx` fetches the viewer's `year_group`; when it's `1`,
  also fetches `timetable_slots` and passes them through `expandTimetableSlots` before
  calling `getCalendarEvents`.
- Calendar page's colour key gains a "Class" entry (purple) alongside the existing
  session/match/deadline/event colours.
- Parent/admin calendar pages are unchanged — visibility stays scoped to 1st-year
  students, per the approved design.

## Notifications

- `lib/dates.ts` gains `londonWeekday(date: Date): number` — returns 0–6 (Sun–Sat, same
  convention as JS `getDay()` and `schedule_slots.day_of_week`), computed in
  `Europe/London` so the cron reasons in local wall-clock terms, not server UTC.
- `lib/timetable/timetableUtils.ts` — new pure helper module:
  - `getSlotsDueForReminder(slots, now, todayISO)` — given today's slots (already
    filtered by weekday) and the current instant, returns the slots whose computed start
    instant (via `londonWallTimeToUTC(todayISO, slot.start_time)`) falls 13–18 minutes
    from `now`. Extracted as a pure function so it's unit-testable without touching the
    DB or cron plumbing.
- `app/api/cron/timetable-reminders/route.ts` — new cron, same shape as
  `calendar-reminders`/`session-reminders`:
  1. Verify cron secret.
  2. Compute London "now", today's ISO date, and today's weekday.
  3. Fetch `timetable_slots` for today's weekday (across all `year_group`s).
  4. Run `getSlotsDueForReminder` to find slots starting in ~15 minutes.
  5. For each due slot, skip if `timetable_reminder_log` already has a row for
     `(slot.id, today)`.
  6. Fetch students in that slot's `year_group`, then their `push_subscriptions` and
     `native_push_tokens`.
  7. Send via `sendPushNotification` (web) and `sendFcmBatch` (native), pruning dead web
     subscriptions on 404/410 — identical pattern to `calendar-reminders`.
  8. Payload: title `⏰ {title} in 15 mins`, body `{location} · {formatted start time}`,
     url `/timetable`.
  9. Insert into `timetable_reminder_log` regardless of subscriber count, so this
     window is never reprocessed.
- `vercel.json` gains, in the same commit as the route:
  ```json
  { "path": "/api/cron/timetable-reminders", "schedule": "*/5 6-18 * * 1-5" }
  ```
  (06:00–18:59 UTC, Mon–Fri, covers 07:00–19:59 BST and 06:00–18:59 GMT — wide enough for
  any realistic college day either side of the DST change.)

## Testing

- `expandTimetableSlots` — unit tests: correct dates emitted for a window, Wednesday
  slots never appear (defence in depth even though none should exist), slot spanning a
  month boundary.
- `getSlotsDueForReminder` — unit tests: slot 15 minutes out is due, slot 5 minutes out
  is not yet due, slot 20 minutes out is not due, slot exactly at the window edges.
- `londonWeekday` — unit test across a BST/GMT boundary date to confirm it doesn't drift
  a day either side of midnight UTC.

## Out of scope (explicitly, per approved design)

- 2nd-year timetable data entry (schema supports it; no UI exposes it yet).
- Parent/staff visibility into the 1st-year timetable.
- Representing Wednesday match fixtures from `match_events` on the timetable page (no
  fixtures exist yet for these Wednesdays — revisit once they do).
- Per-slot notification opt-out/preferences.
