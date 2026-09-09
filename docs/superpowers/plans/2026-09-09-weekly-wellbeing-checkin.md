# Weekly Wellbeing Check-in Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Change the wellbeing check-in cadence from fortnightly to weekly, update every place that describes the cadence to match, remove the now-dead fortnightly gating code, and fix the same missing-native-push gap already fixed at two other call sites tonight for this cron's student reminder.

**Architecture:** One cron route loses its week-parity gate and swaps its push mechanism to the existing `notifyUsers` dual-channel helper; one now-unused function and its tests are deleted; five copy references across student UI, a dashboard card, the privacy policy, and two internal docs are updated for consistency. No schema changes, no `vercel.json` changes (the cron already runs every Monday).

**Tech Stack:** Next.js 14 API route (cron), Supabase admin client, Jest (route-handler test following this repo's established convention — mocked Supabase client, direct import of `GET`).

## Global Constraints

- Cadence-only change — no change to survey questions, red-flag thresholds, or safeguarding logic. (design spec)
- No trend-based/chronic-case staff-alert escalation — explicitly out of scope. (design spec)
- No `vercel.json` change — the cron already runs every Monday; only the in-code gate changes. (design spec)
- `supabase/migrations/023_wellbeing.sql`'s header comment is **not** touched — migrations are a historical record, not living documentation. (design spec)
- TypeScript strict — no `any` without justification.

---

## File Structure

| File | Change |
|---|---|
| `app/api/cron/wellbeing-survey/route.ts` (modified) | Remove the `isFortnightlyWeek` gate; swap `sendPushNotification` loop for `notifyUsers`; update push copy to "weekly". |
| `lib/wellbeing/wellbeingUtils.ts` (modified) | Delete `isFortnightlyWeek` — no longer called anywhere once the gate above is removed. |
| `__tests__/lib/wellbeing/wellbeingUtils.test.ts` (modified) | Delete the `isFortnightlyWeek` describe block (5 tests). |
| `__tests__/lib/wellbeing/wellbeingSurveyRoute.test.ts` (new) | Route-level tests: fires regardless of ISO week parity, skips students with an already-open survey this week, calls `notifyUsers` with the weekly copy. Follows this repo's established route-testing convention (see `__tests__/lib/wellbeing/submitRoute.test.ts` for the pattern — same directory). |
| `app/(student)/wellbeing/page.tsx` (modified) | "Every two weeks" → "Every week" (one line, no test asserts this exact string). |
| `components/wellbeing/WellbeingPromptCard.tsx` (modified) | "Your fortnightly wellbeing survey is ready." → "Your weekly wellbeing survey is ready." (existing test asserts only a regex pattern, not this literal string — confirmed it still passes). |
| `app/privacy/page.tsx` (modified) | "fortnightly wellbeing survey answers" → "weekly wellbeing survey answers". |
| `docs/FEATURE-STATUS.md` (modified) | "Bi-weekly wellbeing survey (2nd Monday)" → "Weekly wellbeing survey (every Monday)". |
| `docs/QUICK-WINS-PLAN.md` (modified) | Heading + the sentence explaining the now-removed ISO-week-parity gate, updated to describe the current every-Monday behavior. |

---

## Task 1: Remove the fortnightly gate and swap to the dual-channel notify helper

**Files:**
- Modify: `app/api/cron/wellbeing-survey/route.ts`
- Modify: `lib/wellbeing/wellbeingUtils.ts`
- Modify: `__tests__/lib/wellbeing/wellbeingUtils.test.ts`
- Test: `__tests__/lib/wellbeing/wellbeingSurveyRoute.test.ts`

**Interfaces:**
- Consumes: `notifyUsers(admin: SupabaseClient, userIds: string[], notification: {title, body, url}): Promise<void>` from `lib/notifications/notifyStaff.ts` (existing, built earlier tonight, already proven never to throw).

- [ ] **Step 1: Write the failing route test**

Create `__tests__/lib/wellbeing/wellbeingSurveyRoute.test.ts`:

```ts
/**
 * @jest-environment node
 */
const adminFromMock = jest.fn()
const notifyUsersMock = jest.fn(() => Promise.resolve())

jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: adminFromMock }),
}))
jest.mock('@/lib/security', () => ({
  verifyCronSecret: () => true,
}))
jest.mock('@/lib/notifications/notifyStaff', () => ({
  notifyUsers: (...args: unknown[]) => notifyUsersMock(...args),
}))

import { NextRequest } from 'next/server'
import { GET } from '@/app/api/cron/wellbeing-survey/route'

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost/api/cron/wellbeing-survey')
}

/** Wires the admin client for the two tables this route touches. */
function setupAdmin(opts: {
  students?: { id: string }[]
  existingOpenStudentIds?: string[]
  insertError?: { message: string } | null
} = {}) {
  const {
    students = [{ id: 'student-1' }, { id: 'student-2' }],
    existingOpenStudentIds = [],
    insertError = null,
  } = opts

  const insertMock = jest.fn(() => Promise.resolve({ error: insertError }))

  adminFromMock.mockImplementation((table: string) => {
    if (table === 'users') {
      return {
        select: () => ({
          eq: () => ({
            eq: () => Promise.resolve({ data: students, error: null }),
          }),
        }),
      }
    }
    if (table === 'wellbeing_surveys') {
      return {
        select: () => ({
          eq: () => ({
            gte: () => Promise.resolve({ data: existingOpenStudentIds.map(id => ({ student_id: id })) }),
          }),
        }),
        insert: insertMock,
      }
    }
    throw new Error(`Unexpected table: ${table}`)
  })

  return { insertMock }
}

beforeEach(() => {
  adminFromMock.mockReset()
  notifyUsersMock.mockClear()
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

describe('GET /api/cron/wellbeing-survey', () => {
  it('sends on an ISO week that the old fortnightly gate would have skipped', async () => {
    // 2024-01-08 is ISO week 2 (even) — the old isFortnightlyWeek gate returned
    // false for this date and the route would have skipped entirely.
    jest.setSystemTime(new Date('2024-01-08T09:00:00Z'))
    setupAdmin()
    const res = await GET(makeRequest())
    const json = await res.json()
    expect(json).toEqual({ sent: 2 })
  })

  it('sends on an ISO week the old gate would also have fired on (regression guard)', async () => {
    // 2024-01-01 is ISO week 1 (odd) — old gate would have fired here too.
    jest.setSystemTime(new Date('2024-01-01T09:00:00Z'))
    setupAdmin()
    const res = await GET(makeRequest())
    const json = await res.json()
    expect(json).toEqual({ sent: 2 })
  })

  it('skips a student who already has an open survey this week', async () => {
    jest.setSystemTime(new Date('2024-01-08T09:00:00Z'))
    const { insertMock } = setupAdmin({ existingOpenStudentIds: ['student-1'] })
    const res = await GET(makeRequest())
    const json = await res.json()
    expect(json).toEqual({ sent: 1 })
    expect(insertMock).toHaveBeenCalledWith([{ student_id: 'student-2', status: 'open' }])
    expect(notifyUsersMock).toHaveBeenCalledWith(
      expect.anything(),
      ['student-2'],
      expect.anything()
    )
  })

  it('notifies via notifyUsers with the weekly copy, not the old per-subscription push', async () => {
    jest.setSystemTime(new Date('2024-01-08T09:00:00Z'))
    setupAdmin()
    await GET(makeRequest())
    expect(notifyUsersMock).toHaveBeenCalledTimes(1)
    const [, userIds, notification] = notifyUsersMock.mock.calls[0]
    expect(userIds.sort()).toEqual(['student-1', 'student-2'])
    expect(notification).toEqual(
      expect.objectContaining({
        title: 'Wellbeing Check-in 💙',
        url: '/wellbeing',
      })
    )
    expect(notification.body).toMatch(/weekly/i)
    expect(notification.body).not.toMatch(/fortnightly/i)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest wellbeingSurveyRoute -v`
Expected: FAIL — the route still imports `isFortnightlyWeek` and skips on even weeks (the first test, 2024-01-08, would currently return `{ skipped: true, reason: 'even week' }` instead of `{ sent: 2 }`), and still calls `sendPushNotification` rather than `notifyUsers` (the fourth test's `notifyUsersMock` assertion fails — never called).

- [ ] **Step 3: Update the route**

Replace the full contents of `app/api/cron/wellbeing-survey/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyUsers } from '@/lib/notifications/notifyStaff'
import { verifyCronSecret } from '@/lib/security'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()

  const admin = createAdminClient()

  // Get all active students
  const { data: students, error: studentsErr } = await admin
    .from('users')
    .select('id')
    .eq('role', 'student')
    .eq('is_active', true)

  if (studentsErr || !students?.length) {
    return NextResponse.json({ error: studentsErr?.message ?? 'no students' }, { status: 500 })
  }

  // Find students who already have an open survey this week
  const weekStart = new Date(now)
  weekStart.setUTCHours(0, 0, 0, 0)
  weekStart.setUTCDate(now.getUTCDate() - (now.getUTCDay() || 7) + 1) // Monday

  const { data: existing } = await admin
    .from('wellbeing_surveys')
    .select('student_id')
    .eq('status', 'open')
    .gte('sent_at', weekStart.toISOString())

  const alreadySent = new Set((existing ?? []).map(r => r.student_id))

  const targets = students.filter(s => !alreadySent.has(s.id))

  if (!targets.length) {
    return NextResponse.json({ sent: 0, reason: 'all students already have open survey' })
  }

  // Insert survey rows
  const { error: insertErr } = await admin
    .from('wellbeing_surveys')
    .insert(targets.map(s => ({ student_id: s.id, status: 'open' })))

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  // Notify targets — dual-channel (web push + native/FCM)
  await notifyUsers(
    admin,
    targets.map(s => s.id),
    {
      title: 'Wellbeing Check-in 💙',
      body: 'Your weekly wellbeing survey is ready — takes 60 seconds.',
      url: '/wellbeing',
    }
  )

  return NextResponse.json({ sent: targets.length })
}
```

- [ ] **Step 4: Delete `isFortnightlyWeek` from `wellbeingUtils.ts`**

In `lib/wellbeing/wellbeingUtils.ts`, remove this block entirely (it sits between `normalizedScore` and `getRedFlags`):

```ts
/** Returns true on odd ISO weeks (1, 3, 5...) — the fortnightly fire weeks */
export function isFortnightlyWeek(date: Date): boolean {
  // ISO week: Thursday determines the week year
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = d.getUTCDay() || 7 // make Sunday = 7
  d.setUTCDate(d.getUTCDate() + 4 - day) // move to Thursday
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return weekNo % 2 !== 0
}

```

(Leave the blank line pattern consistent with the surrounding code — one blank line between functions, not two.)

- [ ] **Step 5: Delete its tests from `wellbeingUtils.test.ts`**

In `__tests__/lib/wellbeing/wellbeingUtils.test.ts`:

Remove `isFortnightlyWeek` from the import list. Change:

```ts
import {
  isFortnightlyWeek,
  getRedFlags,
  validateSurveyAnswers,
  buildWellbeingTrend,
  normalizedScore,
  getScoreLabel,
  SURVEY_QUESTIONS,
} from '@/lib/wellbeing/wellbeingUtils'
```

to:

```ts
import {
  getRedFlags,
  validateSurveyAnswers,
  buildWellbeingTrend,
  normalizedScore,
  getScoreLabel,
  SURVEY_QUESTIONS,
} from '@/lib/wellbeing/wellbeingUtils'
```

Remove the entire `describe('isFortnightlyWeek', ...)` block (lines 13-40 in the current file — the 5 tests shown in this plan's context above, from `describe('isFortnightlyWeek', () => {` through its closing `})`).

- [ ] **Step 6: Run the new and updated tests to verify they pass**

Run: `npx jest wellbeingSurveyRoute wellbeingUtils -v`
Expected: PASS (4 new route tests; wellbeingUtils suite passes with 5 fewer tests than before)

- [ ] **Step 7: Update the five copy references**

7a. `app/(student)/wellbeing/page.tsx` — change:

```tsx
        <p className="text-xs text-muted-foreground mt-0.5">Takes about 60 seconds · Every two weeks</p>
```

to:

```tsx
        <p className="text-xs text-muted-foreground mt-0.5">Takes about 60 seconds · Every week</p>
```

7b. `components/wellbeing/WellbeingPromptCard.tsx` — change:

```tsx
      <p className="text-sm font-semibold leading-snug">Your fortnightly wellbeing survey is ready.</p>
```

to:

```tsx
      <p className="text-sm font-semibold leading-snug">Your weekly wellbeing survey is ready.</p>
```

7c. `app/privacy/page.tsx` — change:

```tsx
            <li><strong>Wellbeing and pastoral</strong> — fortnightly wellbeing survey answers,
              learner reviews, and safeguarding records (staff-recorded, strictly access-controlled).</li>
```

to:

```tsx
            <li><strong>Wellbeing and pastoral</strong> — weekly wellbeing survey answers,
              learner reviews, and safeguarding records (staff-recorded, strictly access-controlled).</li>
```

7d. `docs/FEATURE-STATUS.md` — change:

```
| Bi-weekly wellbeing survey (2nd Monday) | ✅ |
```

to:

```
| Weekly wellbeing survey (every Monday) | ✅ |
```

7e. `docs/QUICK-WINS-PLAN.md` — change:

```
## Quick Win 1 — Bi-weekly Wellbeing Survey
```

to:

```
## Quick Win 1 — Weekly Wellbeing Survey
```

and change:

```
- Cron `app/api/cron/wellbeing-survey/route.ts` — runs every **2nd Monday** (cron can't do fortnightly natively → run every Monday, gate in code on ISO-week parity). Creates a survey row per active student + push notification. Add to `vercel.json`.
```

to:

```
- Cron `app/api/cron/wellbeing-survey/route.ts` — runs every **Monday**. Creates a survey row per active student + push notification (`vercel.json`, unchanged).
```

- [ ] **Step 8: Run the full suite and type-check**

Run: `npx jest --silent`
Expected: PASS, total test count = pre-task baseline − 5 (removed) + 4 (added) = baseline − 1

Run: `npx tsc --noEmit 2>&1 | grep -v __tests__`
Expected: no new errors outside `__tests__/`

- [ ] **Step 9: Commit**

```bash
git add app/api/cron/wellbeing-survey/route.ts lib/wellbeing/wellbeingUtils.ts __tests__/lib/wellbeing/wellbeingUtils.test.ts __tests__/lib/wellbeing/wellbeingSurveyRoute.test.ts "app/(student)/wellbeing/page.tsx" components/wellbeing/WellbeingPromptCard.tsx app/privacy/page.tsx docs/FEATURE-STATUS.md docs/QUICK-WINS-PLAN.md
git commit -m "feat(wellbeing): change check-in cadence from fortnightly to weekly

Given the scale of change these students are navigating, more frequent
touchpoints are worth it. The cron already ran every Monday
(vercel.json) — isFortnightlyWeek() was the in-code gate skipping every
other week; removed entirely, along with its now-dead function and
tests. Also swaps this cron's student-reminder push from the old
web-push-only sendPushNotification to notifyUsers (dual-channel web
push + native/FCM, built earlier tonight) — students on the native app
were never receiving this reminder at all.

Updated every place that described the old cadence: student check-in
page, dashboard prompt card, the privacy policy's data-collection
disclosure, and two internal docs. Cadence/copy only — no change to
survey questions, red-flag thresholds, or safeguarding logic.

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

## Self-Review

**Spec coverage:**
- Remove fortnightly gate, cron fires every Monday → Step 3. ✅
- Delete dead `isFortnightlyWeek` + its tests → Steps 4-5. ✅
- Swap to `notifyUsers` for the student reminder → Step 3. ✅
- All five copy locations updated → Step 7 (a-e). ✅
- Migration file NOT touched → not present anywhere in this plan. ✅
- No `vercel.json` change → not present anywhere in this plan. ✅
- `WellbeingPromptCard.tsx`'s existing test confirmed unaffected → noted in File Structure table; not re-verified with a new test since the design spec already confirmed the existing regex-based assertions don't pin the literal string.

**Placeholder scan:** No TBD/TODO; every step has complete, copy-pasteable code or exact before/after text.

**Type consistency:** `notifyUsers(admin, userIds, notification)` call in Step 3 matches its existing signature in `lib/notifications/notifyStaff.ts` exactly (verified against the file directly, not just this plan's memory of it).

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-09-weekly-wellbeing-checkin.md`. Two execution options:

1. **Subagent-Driven (recommended)** — fresh subagent for this task, review after.
2. **Inline Execution** — execute in this session with a checkpoint for review.

Which approach?
