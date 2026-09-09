# Weekly Wellbeing Check-in — Design

**Date:** 2026-09-09
**Status:** Approved by product owner (Paul).

## Background

The wellbeing check-in currently fires fortnightly (every two weeks). Given the scale of change these students are navigating — new academy environment, adolescence, athletic and academic pressure combined — the product owner wants more frequent touchpoints: weekly instead of fortnightly.

## Goal

Change the wellbeing check-in cadence from fortnightly to weekly, and bring every place that describes the cadence (UI copy, privacy disclosure, internal docs) into consistency with the new reality — a stale "fortnightly" string left behind would be actively misleading, not just untidy, especially in the privacy policy.

## Non-goals

- No change to the survey's content/questions, red-flag thresholds, or safeguarding logic — this is a cadence change only. (Question content and staff-side triage quality are a separate, larger brainstorm.)
- No trend-based / chronic-case escalation logic for staff alerts. Going weekly roughly doubles how often a repeatedly-flagged student re-triggers the same undifferentiated staff push — worth a future brainstorm on distinguishing "flagged once" from "flagged N weeks running," but explicitly not built here.
- No change to `vercel.json` — the cron (`app/api/cron/wellbeing-survey/route.ts`) already runs every Monday; only the in-code fortnightly gate changes.

## Architecture

### 1. `app/api/cron/wellbeing-survey/route.ts` (modified) — the core change

- Remove the `isFortnightlyWeek` import and the `if (!isFortnightlyWeek(now)) return ... skipped` gate. The route now runs its existing logic (find active students without an already-open survey this week, insert survey rows, notify) every Monday, unconditionally.
- Push notification body: "Your fortnightly wellbeing survey is ready — takes 60 seconds." → "Your weekly wellbeing survey is ready — takes 60 seconds."
- Swap the student-reminder push from `sendPushNotification` (looped per web-push subscription only) to the `notifyUsers` dual-channel helper (`lib/notifications/notifyStaff.ts`, built earlier tonight for the AI-chat safeguarding fix and already reused by the wellbeing submit route) — students on the native app currently never get this reminder at all, same class of gap already fixed at two other call sites tonight.

### 2. `lib/wellbeing/wellbeingUtils.ts` (modified) — dead code removal

- Delete `isFortnightlyWeek()`. Confirmed its only non-test consumer was the cron route above; once that gate is gone, nothing else calls it.

### 3. Copy consistency (modified, text-only)

- `app/(student)/wellbeing/page.tsx`: "Takes about 60 seconds · Every two weeks" → "Takes about 60 seconds · Every week"
- `components/wellbeing/WellbeingPromptCard.tsx`: "Your fortnightly wellbeing survey is ready." → "Your weekly wellbeing survey is ready."
- `app/privacy/page.tsx`: "fortnightly wellbeing survey answers" → "weekly wellbeing survey answers" — a minors-facing privacy disclosure; must stay accurate.
- `docs/FEATURE-STATUS.md`: "Bi-weekly wellbeing survey (2nd Monday)" → "Weekly wellbeing survey (every Monday)"
- `docs/QUICK-WINS-PLAN.md`: heading and the sentence explaining the ISO-week-parity gate mechanism → updated to describe the (now simpler) every-Monday behavior, since the gate it's explaining no longer exists.

`supabase/migrations/023_wellbeing.sql`'s header comment ("Bi-weekly wellbeing surveys") is **not** touched — migrations are a historical record of what was applied at the time, not living documentation; rewriting them after the fact is against this project's convention.

## Data flow (unchanged in shape, just ungated)

```
Cron fires every Monday 09:00 UTC (vercel.json, unchanged)
  → [REMOVED: isFortnightlyWeek(now) skip-on-even-weeks gate]
  → find active students without an open survey this week (unchanged logic)
  → insert wellbeing_surveys rows (unchanged)
  → notify targets via notifyUsers (was: sendPushNotification, web-push only)
```

## Testing

- `__tests__/lib/wellbeing/wellbeingUtils.test.ts`: delete the `isFortnightlyWeek` describe block (5 tests) — the function no longer exists.
- `__tests__/app/api/cron/wellbeingSurveyRoute.test.ts` (new — no test currently exists for this route): following this repo's established route-testing convention (mocked Supabase admin client, direct import of the route's `GET`), cover:
  - Runs and sends every time it's invoked (no week-parity skip) — call it with two different `Date`s that would previously have landed on opposite sides of the old odd/even-week gate, assert both send.
  - Skips a student who already has an open survey this week (existing behavior, unchanged — regression guard).
  - Calls `notifyUsers` (mocked) with the target student ids and the updated "weekly" copy, not the old per-subscription `sendPushNotification`.
- `components/wellbeing/WellbeingPromptCard.tsx`'s existing test (`__tests__/components/WellbeingPromptCard.test.tsx`) asserts on patterns (`/wellbeing/i`, `/survey|complete|check.?in/i`), not the literal word "fortnightly" — confirmed it needs no change and will still pass.
