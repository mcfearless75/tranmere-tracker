# Student Wellbeing Trend View — Design

**Date:** 2026-09-10
**Status:** Approved by product owner (Paul).

## Background

Two independent research reports tonight (`docs/research/2026-09-10-checkin-question-quality-research.md`, `docs/research/2026-09-10-teen-wellbeing-apps-research.md`) converged on the same finding: teens answer a wellbeing check-in honestly when they can see that answering changed something. Right now a student submits the wellbeing survey and only ever sees a one-off "thanks 💙" — never their own history. This is a genuine data-validity concern (per the cited athlete self-report literature — "if they think that no-one's looking at it then they'll just give dummy responses"), not just a UX nicety.

This is the first of two related pieces the product owner approved building tonight (the other — a context chip-picker + a new social-connection question — is a separate spec). This piece is scoped narrowly: an overall trend line only, no per-question breakdown, no notes-read-back (explicit product-owner scope decision — those may come later but are not part of this build).

## Goal

A student can see their own overall wellbeing trend over their last ~10 completed check-ins, on the same `/wellbeing` page they already visit to do the check-in itself.

## Non-goals

- No per-question breakdown (mood vs. sleep vs. stress shown separately) — explicitly deferred.
- No display of their own past free-text notes — explicitly deferred.
- No change to the check-in form itself, survey questions, or safeguarding/red-flag logic.
- No new migration or RLS policy change — confirmed unnecessary (see Architecture).

## Architecture

### RLS — confirmed no change needed

`supabase/migrations/023_wellbeing.sql` already has `"students select own surveys"` and `"students select responses"` policies with no status filter (`using (student_id = auth.uid())` / the equivalent join) — a student can already `select` **any** of their own `wellbeing_surveys`/`wellbeing_responses` rows, not just open ones. This feature needs no schema or policy change.

### 1. `components/wellbeing/WellbeingTrendChart.tsx` (new)

A full-size line chart (not the existing 80×32px `WellbeingSparkline`, which is a different job — a compact admin-list-row indicator — kept separate rather than stretched to fit two purposes). Props: `data: SurveyTrendPoint[]` (the same type `buildWellbeingTrend` already produces, reused as-is, no duplication). Renders:
- Fewer than 2 points: a friendly empty state ("Complete a couple more check-ins to see your trend appear here") rather than blank space — a dedicated page showing nothing looks broken in a way a small sparkline returning `null` doesn't.
- 2+ points: a recharts `LineChart`, oldest-to-newest left to right, y-axis fixed 1-5, x-axis showing each point's date (`DD Mon`), matching this app's existing chart conventions (recharts is already a dependency, already used the same way by `WellbeingSparklineInner`).

### 2. `app/(student)/wellbeing/page.tsx` (modified)

- Add a `view: 'checkin' | 'trend'` client state (default `'checkin'`) and a small two-option toggle at the top of the page ("Check-in" / "My Trend"), sibling to the existing loading/idle/form/done state machine — switching to `'trend'` doesn't disturb or reset any of that state.
- On switching to `'trend'` (or on mount if simpler — implementer's call, either is fine as long as it doesn't fetch on every render): query the student's own last 10 `completed` surveys with responses via the existing `createBrowserClient` instance already used on this page:
  ```
  supabase.from('wellbeing_surveys')
    .select('sent_at, wellbeing_responses(question_key, score)')
    .eq('student_id', user.id)
    .eq('status', 'completed')
    .order('sent_at', { ascending: false })
    .limit(10)
  ```
- Reverse the result (oldest-first, matching the existing admin-page pattern: `buildWellbeingTrend([...group].reverse())`) and pass through `buildWellbeingTrend` (existing, `lib/wellbeing/wellbeingUtils.ts` — already correctly normalizes the reverse-coded `stress` question via `normalizedScore`, so the trend line's direction is already "higher = better" consistently, no new bug surface here).
- Render `WellbeingTrendChart` with the result.

## Data flow

```
Student taps "My Trend" tab
  → (if not already fetched) query last 10 completed surveys + responses (own RLS, unchanged)
  → reverse to oldest-first
  → buildWellbeingTrend() [existing, reused]
  → <WellbeingTrendChart data={...} />
       0-1 points → empty-state message
       2+ points  → line chart, 1-5 y-axis, dated x-axis
```

## Error handling

- Query failure: same fail-soft pattern already used elsewhere on this page (e.g. the existing open-survey lookup just falls through to a state check) — show the empty-state message rather than an error, since this is a secondary, non-critical view; log via `console.error` for diagnosis, don't block or alarm the student.

## Testing

- `WellbeingTrendChart.test.tsx` (new): renders the empty state for 0 and 1 data points; renders a chart for 2+ points. Neither `WellbeingSparklineInner` nor `WellbeingSparkline` has an existing test, but `__tests__/components/charts/AttendanceBar.test.tsx` already establishes this repo's convention for testing a recharts component in jsdom — mock `recharts`'s `ResponsiveContainer` to render its children directly, and stub `global.ResizeObserver` (jsdom has neither real layout nor `ResizeObserver`). Follow that exact pattern rather than inventing a new one.
- `app/(student)/wellbeing/page.tsx` test additions (no test file currently exists for this page — confirmed): toggling to "My Trend" triggers the completed-surveys query with the right filters (`status='completed'`, `limit(10)`); switching back to "Check-in" preserves whatever check-in-flow state was already there (e.g. mid-form answers aren't lost by tab-switching away and back — confirm this is actually true given how state is structured, and if it turns out to require extra work to preserve, flag it rather than silently deciding either way).
