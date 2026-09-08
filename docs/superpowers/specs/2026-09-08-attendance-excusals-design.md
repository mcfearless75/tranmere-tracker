# Attendance Excusals (Ill / Appointment) — Design

## Problem

The Daily Attendance page has only two states per phase (AM/Lunch/PM): checked-in, or blank. When a parent calls or emails to say a student is off ill or at an appointment, staff currently have no honest way to record it:

- Leaving the phase blank makes the student show as "Missing," which feeds the `missed-checkin-sweep` and `attendance-safeguarding-check` cron alerts — staff get pushed "⚠️ N not checked in" notifications for students they already know are off, which is noise that erodes trust in the alert.
- Using the existing "Mark" override (`OverrideButton.tsx`) falsely records the student as physically checked in and gets auto-flagged as an anomaly, polluting the flagged count and the audit trail.

## Goal

Give staff a one-click way to record why a student isn't expected in, that:
1. Is truthful in the data (doesn't fake a check-in).
2. Suppresses the missed-checkin and safeguarding alerts for that student/phase.
3. Doesn't count against the student's weekly attendance % (authorised-absence treatment).
4. Defaults to covering the whole day, but can be narrowed to specific phases (e.g. appointment only covers AM; student returns for PM).

## Data model

New table, kept separate from `daily_attendance` so "did they physically check in" (evidence: GPS, selfie, NFC tap) stays distinct from "why weren't they expected in" (a staff-entered reason with no evidence attached):

```sql
CREATE TABLE attendance_excusals (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  excused_date  date NOT NULL,
  reason        text NOT NULL CHECK (reason IN ('ill', 'appointment', 'other')),
  note          text,                          -- optional, e.g. "dentist, back for PM"
  phases        text[] NOT NULL DEFAULT ARRAY['am','lunch','pm'],
  created_by    uuid NOT NULL REFERENCES users(id),
  created_at    timestamptz DEFAULT now(),
  UNIQUE(student_id, excused_date)
);

CREATE INDEX idx_attendance_excusals_date ON attendance_excusals(excused_date);

ALTER TABLE attendance_excusals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "excusals_staff_all" ON attendance_excusals FOR ALL USING (public.is_staff());
CREATE POLICY "excusals_self_read" ON attendance_excusals FOR SELECT USING (auth.uid() = student_id);
```

One row per student per day (`UNIQUE(student_id, excused_date)`) — editing the reason or narrowing `phases` is an UPDATE, not a new row. Deleting the row is the "Undo."

## Components

**`ExcuseButton.tsx`** (new, alongside `OverrideButton.tsx`) — per-student-row control on the Daily Attendance page:
- Default state: small "Excuse" button.
- Click opens a lightweight inline choice: Ill / Appointment / Other, each with an optional one-line note field. Submitting writes the whole-day row (`phases = ['am','lunch','pm']`).
- Once excused, the button becomes a status pill (e.g. "Ill", "Appt") with an "Undo" affordance that deletes the row.
- Per-phase override: each `PhaseCell` that falls within an active excusal's `phases` array renders the excused pill instead of the blank "—"/Mark control. Staff can still narrow coverage (e.g. remove `'pm'` from `phases`) via a small edit affordance on the pill, which reverts that single phase to the normal Mark/blank cell.

**`app/api/attendance/excuse/route.ts`** (new) — POST to create/update an excusal (`{ studentId, date, reason, note?, phases? }`), DELETE to clear it. Staff-only (`requireRole`), mirrors the existing `manual-override` route's auth pattern.

**Daily Attendance page (`page.tsx`)** — fetch `attendance_excusals` for the visible date alongside the existing `daily_attendance` query; pass excusal state into each row/`PhaseCell`. Add an **Excused** summary tile. **Missing** tile's count excludes any phase covered by an excusal.

## Data flow / alert suppression

`missed-checkin-sweep` and `attendance-safeguarding-check` both currently build their "missing" list as: all active students minus those with a `*_checked_at` for the phase. Both need a second exclusion: minus any student with an `attendance_excusals` row for that date where `phases` contains the current phase. This is a single additional query (or one LEFT JOIN) per cron run, filtered to today's date.

## Reporting

Weekly PDF (`print/week/page.tsx`) currently computes `weekPct` as checks-completed ÷ 3-per-day. Excused phases are treated as authorised absence: **excluded from both numerator and denominator**, not counted as present and not counted against the %. The report gains a small per-student "Ill/Appt" count for the week, shown alongside the %, so a reviewer can see authorised absence separately from the raw attendance figure — this matches standard college/Ofsted-style attendance-code reporting (present / authorised absence / unauthorised absence, not blended into one number).

## Error handling

- Duplicate excusal for the same student/date: `UNIQUE(student_id, excused_date)` means the API does an upsert (update reason/note/phases) rather than erroring, since staff correcting an entry (e.g. "Appointment" → "Ill") is a normal case.
- Excusing a phase that's already checked in: block it client-side (the Excuse control doesn't render over an existing check-in) — if a student already tapped in for AM, staff can't also mark AM excused; they'd narrow `phases` to exclude `'am'` if excusing the rest of the day.
- Race with a live check-in (student taps in after being marked ill): the check-in RPC is unaffected by this table, so a genuine tap-in still records normally; the UI should reflect both (excused pill for phases not checked in, real check-in time for the phase that came in) rather than one overwriting the other.

## Testing

- Jest tests for the new `excuse` API route: create, update (reason change), narrow `phases`, delete, and the duplicate-date upsert path.
- Unit test for the missed-checkin-sweep and safeguarding-check exclusion logic (excused student does not appear in the "missing" list for a covered phase, does appear for an uncovered one).
- Weekly report % calculation test: excused phases excluded from denominator.
