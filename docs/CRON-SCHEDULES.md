# Cron schedules — London time ↔ UTC

Vercel cron schedules in `vercel.json` are fixed UTC with no DST awareness.
JSON doesn't support comments, so the London-time intent lives here instead.

The UK's offset from UTC is always a whole number of hours (0 in GMT, +1 in
BST) — the minute never shifts, only the hour. For every job below that's
meant to fire at a fixed London wall-clock time, `vercel.json` schedules it
**twice**: once at the BST UTC time, once at the GMT UTC time. The route
itself checks the real London hour (`londonHour()` from `lib/dates.ts`) and
only acts when it's actually the intended hour — so exactly one of the two
invocations does anything on any given day, self-correcting across the
clock change with no manual schedule edit needed. 2026's change: clocks go
back on 25 Oct (BST → GMT).

| Job | Intended London time | BST schedule (UTC) | GMT schedule (UTC) | Guard |
|---|---|---|---|---|
| `attendance-report-am` | 10:30 weekdays | `30 9 * * 1-5` | `30 10 * * 1-5` | `londonHour() === 10` |
| `attendance-report-pm` | 17:30 weekdays | `30 16 * * 1-5` | `30 17 * * 1-5` | `londonHour() === 17` |
| `wellbeing-survey` | Monday 10:00 | `0 9 * * 1` | `0 10 * * 1` | `londonHour() === 10` |
| `check-in-nudges` | 09:00 / 13:00 / 16:00 weekdays | `0 8`, `0 12`, `0 15` `* * 1-5` | `0 9`, `0 13`, `0 16` `* * 1-5` | `londonHour()` in `[9, 13, 16]` |
| `lunch-ending` | 12:45 weekdays | `45 11 * * 1-5` | `45 12 * * 1-5` | `londonHour() === 12` |
| `calendar-reminders` | 09:00 daily | `0 8 * * *` | `0 9 * * *` | `londonHour() === 9` |

`check-in-nudges` needs the exact-hour guard for a second reason beyond DST:
its phase (am/lunch/pm) was originally derived from a London-hour *range*
(`<11` → am, `11–14` → lunch, else pm), not the intended exact time. Without
the guard, both the BST and GMT entries would fire year-round — during BST
the GMT-side entries land an hour later but still inside the same phase
window, producing a redundant second nudge every day, not just a DST-week
bug.

## Not dual-scheduled (by design)

These don't target a single London wall-clock moment, so the dual-entry
pattern doesn't apply:

- `missed-checkin-sweep`, `attendance-safeguarding-check` — `*/15 7-19 * * 1-5`.
  Window-based sweeps against staff-configurable deadlines (`academy_settings`),
  not a fixed instant; self-gated per phase/day via a DB dedup instead (see
  below).
- `session-reminders` — `*/5 * * * *`. A window, not an instant.
- `timetable-reminders` — `*/5 6-18 * * 1-5`. A window, not an instant.
- `refresh-reports` — `0 2 * * *`. Runs in the dead of night; an hour's drift
  around the DST changeover is immaterial for this one.
- `schedule-reviews` — `0 8 1 9,1,4 *`. Termly, not daily — an hour's drift
  three times a year is immaterial.

## Idempotency (duplicate-key error cleanup)

`missed-checkin-sweep`, `attendance-safeguarding-check`'s stage-1 nudge, and
`attendance-safeguarding-check`'s stage-2 case-raise all gate "fire once per
phase/day" via a DB-level unique constraint, checked through an upsert
rather than a plain insert — so a repeat or racing invocation gets zero rows
back and **no Postgres-level error**, instead of a caught-but-still-logged
duplicate-key violation. Confirmed live via the Supabase log explorer
(2026-09-15): ~555 duplicate-key errors/day combined across these three
insert sites before this fix, all from the same already-gated student/phase
being retried on every subsequent 15-minute tick — behaviour was already
correct (no duplicate notifications), just noisy enough in the log stream to
bury genuine failures.

`safeguarding_concerns`' dedup index (`safeguarding_concerns_one_auto_per_day`,
migration 060) is a *partial* unique index (`WHERE raised_by IS NULL`), which
PostgREST's upsert can't target directly (it only ever emits
`ON CONFLICT (columns)`, no `WHERE`). `raise_attendance_safeguarding_concern()`
(migration 070) is a small SQL function that runs the equivalent
`INSERT ... ON CONFLICT (...) WHERE raised_by IS NULL DO NOTHING` server-side
instead.
