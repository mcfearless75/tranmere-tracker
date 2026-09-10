# Check-in Context Chip Picker + Connection Question Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `connection` question (observation-only, not flag-eligible) and a non-scored "what's been on your mind" context chip picker (max 2 tags) to the wellbeing check-in.

**Architecture:** One additive migration, one shared-data-and-logic update in `wellbeingUtils.ts` (question, labels, tag definitions, a validator — the single source of truth for the student page, submit route, and admin page), then three consuming files updated to use it.

**Tech Stack:** Supabase (Postgres migration), Next.js API route, React Client Component, Jest + Testing Library.

## Global Constraints

- `connection` is **not** added to `RED_FLAG_KEYS` — observation-only, deliberate product-owner decision, no fixed revisit date. (design spec)
- No free-text consolidation, no `stress`→`calm` rename — out of scope for this pass. (design spec)
- The 8 context tag keys must match exactly between the DB check constraint, `CONTEXT_TAGS` in `wellbeingUtils.ts`, and the submit route's validator — one drift here breaks either the picker or the ability to save a valid selection. (design spec)
- TypeScript strict — no `any` without justification.

---

## File Structure

| File | Change |
|---|---|
| `supabase/migrations/065_wellbeing_context_tags.sql` (new) | Adds nullable `context_tags text[]` to `wellbeing_surveys`, CHECK-constrained to the 8 allowed values and max 2 elements. |
| `lib/wellbeing/wellbeingUtils.ts` (modified) | Adds `connection` to `SURVEY_QUESTIONS`, its own label scale, `CONTEXT_TAGS` (shared data), `isValidContextTags` (shared validator). |
| `__tests__/lib/wellbeing/wellbeingUtils.test.ts` (modified) | Tests for all of the above, including the key regression guard that `connection` never red-flags. |
| `app/api/wellbeing/submit/route.ts` (modified) | Accepts/validates/saves `context_tags`; error copy no longer hardcodes "5" questions. |
| `__tests__/lib/wellbeing/submitRoute.test.ts` (modified) | Fixes the now-stale 5-key `VALID_ANSWERS` fixture; adds context_tags accept/reject tests. |
| `app/(student)/wellbeing/page.tsx` (modified) | Chip-picker as a new final step after the scored questions; updated time estimate; `handleSubmit` sends `context_tags`. |
| `__tests__/app/wellbeing/WellbeingPage.test.tsx` (modified) | Adds chip-picker-screen, max-2-tags, skip-submit, and time-estimate tests. |
| `app/(admin)/admin/wellbeing/page.tsx` (modified) | Selects and displays `context_tags` as badges; score grid widens from 5 to 6 columns. No new test file (none exists for this page; not required for this change per the earlier detection-gaps spec's established precedent). |

---

## Task 1: Migration + shared question/tag data in `wellbeingUtils.ts`

**Files:**
- Create: `supabase/migrations/065_wellbeing_context_tags.sql`
- Modify: `lib/wellbeing/wellbeingUtils.ts`
- Test: `__tests__/lib/wellbeing/wellbeingUtils.test.ts`

**Interfaces:**
- Produces: `connection` added to `SURVEY_QUESTIONS` (consumed by Tasks 2-4 automatically, since they all iterate `SURVEY_QUESTIONS`); `export const CONTEXT_TAGS: readonly { key: string; label: string; emoji: string }[]` and `export type ContextTagKey`; `export function isValidContextTags(tags: unknown): tags is ContextTagKey[]` — both consumed by Task 2 (validation) and Task 3/4 (rendering).

- [ ] **Step 1: Write the failing tests**

Add to `__tests__/lib/wellbeing/wellbeingUtils.test.ts`. First, add `isValidContextTags` and `CONTEXT_TAGS` to the existing import block:

```ts
import {
  getRedFlags,
  validateSurveyAnswers,
  buildWellbeingTrend,
  normalizedScore,
  getScoreLabel,
  isValidContextTags,
  CONTEXT_TAGS,
  SURVEY_QUESTIONS,
} from '@/lib/wellbeing/wellbeingUtils'
```

Then add these tests. In the `getRedFlags` describe block, after the existing `'flags multiple red-flag keys...'` test:

```ts
  it('does NOT flag a low connection score — observation-only, not a red-flag key', () => {
    expect(getRedFlags([{ question_key: 'connection', score: 1 }])).toHaveLength(0)
  })
```

In the `getScoreLabel` describe block, after the existing stress test:

```ts
  it('uses its own scale for connection, distinct from both the generic and stress scales', () => {
    expect(getScoreLabel('connection', 1)).toBe('Not at all')
    expect(getScoreLabel('connection', 5)).toBe('Completely')
  })
```

New describe blocks at the end of the file:

```ts
describe('CONTEXT_TAGS', () => {
  it('has exactly the 8 keys the DB check constraint allows', () => {
    const keys = CONTEXT_TAGS.map(t => t.key)
    expect(keys).toEqual([
      'football', 'college', 'home', 'friends', 'money', 'health', 'something_else', 'nothing_much',
    ])
  })
})

describe('isValidContextTags', () => {
  it('accepts an empty array', () => {
    expect(isValidContextTags([])).toBe(true)
  })

  it('accepts one or two valid tags', () => {
    expect(isValidContextTags(['home'])).toBe(true)
    expect(isValidContextTags(['home', 'money'])).toBe(true)
  })

  it('rejects more than two tags', () => {
    expect(isValidContextTags(['home', 'money', 'friends'])).toBe(false)
  })

  it('rejects an unrecognized tag', () => {
    expect(isValidContextTags(['not-a-real-tag'])).toBe(false)
  })

  it('rejects a non-array value', () => {
    expect(isValidContextTags('home')).toBe(false)
    expect(isValidContextTags(undefined)).toBe(false)
    expect(isValidContextTags(null)).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest wellbeingUtils -v`
Expected: FAIL — `connection` isn't in `SURVEY_QUESTIONS` yet, `CONTEXT_TAGS`/`isValidContextTags` don't exist yet.

- [ ] **Step 3: Create the migration**

Create `supabase/migrations/065_wellbeing_context_tags.sql`:

```sql
-- ============================================================================
-- 065_wellbeing_context_tags.sql
-- Run in Supabase Dashboard → SQL Editor (or via the Supabase MCP apply_migration tool)
--
-- Adds the "what's been on your mind" context picker to the wellbeing
-- check-in — a non-scored, never-flag-eligible field that makes a low score
-- routable (coursework → tutor, home → DSL, health → physio) instead of an
-- unroutable bare number. See docs/research/2026-09-10-checkin-question-quality-research.md.
--
-- Nullable and additive: existing rows get NULL (no chip data — this
-- predates the feature, not "explicitly picked nothing"). No backfill.
-- ============================================================================

ALTER TABLE public.wellbeing_surveys
  ADD COLUMN IF NOT EXISTS context_tags text[];

ALTER TABLE public.wellbeing_surveys
  ADD CONSTRAINT wellbeing_surveys_context_tags_valid
  CHECK (
    context_tags IS NULL
    OR (
      array_length(context_tags, 1) <= 2
      AND context_tags <@ ARRAY['football', 'college', 'home', 'friends', 'money', 'health', 'something_else', 'nothing_much']::text[]
    )
  );
```

- [ ] **Step 4: Update `wellbeingUtils.ts`**

Replace the full contents of `lib/wellbeing/wellbeingUtils.ts`:

```ts
export const SURVEY_QUESTIONS = [
  { key: 'mood',               label: 'How is your mood today?',         emoji: '😊' },
  { key: 'sleep',              label: 'How well did you sleep?',          emoji: '😴' },
  { key: 'energy',             label: 'How are your energy levels?',      emoji: '⚡' },
  { key: 'stress',             label: 'How stressed are you feeling?',    emoji: '😰' },
  { key: 'connection',         label: 'How connected have you felt to people around you?', emoji: '🤝' },
  { key: 'football_enjoyment', label: 'How much did you enjoy football?', emoji: '⚽' },
] as const

export type QuestionKey = typeof SURVEY_QUESTIONS[number]['key']

export type SurveyResponse = {
  question_key: string
  score: number
}

// Red-flag keys: mood and stress are safeguarding-sensitive.
// Every other question is answered "higher = better" (e.g. great mood, great sleep).
// `stress` is the one question where a HIGH score means a bad outcome ("How stressed
// are you feeling?" — 5 = extremely stressed), so it must be normalized before it's
// compared, averaged, or color-coded alongside the rest.
// `connection` is deliberately NOT a red-flag key yet — it's a brand-new item and
// stays observation-only until there's a term's worth of real data to know it isn't
// just adding noise to staff alerts (docs/research/2026-09-10-checkin-question-quality-research.md).
const RED_FLAG_KEYS: Set<string> = new Set(['mood', 'stress'])
const INVERTED_KEYS: Set<string> = new Set(['stress'])
const RED_FLAG_THRESHOLD = 2

/**
 * Converts a raw 1-5 answer into a "higher = better wellbeing" scale so it can be
 * safely compared/averaged/colored against every other question's score.
 */
export function normalizedScore(key: string, score: number): number {
  return INVERTED_KEYS.has(key) ? 6 - score : score
}

/** Returns responses that should trigger a pastoral alert */
export function getRedFlags(responses: SurveyResponse[]): SurveyResponse[] {
  return responses.filter(
    r => RED_FLAG_KEYS.has(r.question_key) && normalizedScore(r.question_key, r.score) <= RED_FLAG_THRESHOLD
  )
}

export type SurveyTrendPoint = {
  sentAt: string
  avg: number
}

/** Converts an array of surveys (each with responses) into avg-score trend points */
export function buildWellbeingTrend(
  surveys: Array<{ sent_at: string; wellbeing_responses: { question_key?: string; score: number }[] }>
): SurveyTrendPoint[] {
  return surveys.map(s => {
    const scores = s.wellbeing_responses.map(r =>
      r.question_key ? normalizedScore(r.question_key, r.score) : r.score
    )
    const avg = scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) / 10
      : 0
    return { sentAt: s.sent_at, avg }
  })
}

const GENERIC_SCORE_LABELS = ['', 'Very Low', 'Low', 'Okay', 'Good', 'Great']
const STRESS_SCORE_LABELS = ['', 'Not at all', 'A little', 'Moderately', 'Very', 'Extremely']
const CONNECTION_SCORE_LABELS = ['', 'Not at all', 'A little', 'Fairly', 'Very', 'Completely']

/** Question-aware label for a raw 1-5 score — stress/connection read as "how much", not "how good" */
export function getScoreLabel(key: string, score: number): string {
  const labels =
    key === 'stress' ? STRESS_SCORE_LABELS :
    key === 'connection' ? CONNECTION_SCORE_LABELS :
    GENERIC_SCORE_LABELS
  return labels[score] ?? ''
}

/** Validates every survey question is answered with a score 1-5 */
export function validateSurveyAnswers(answers: Record<string, number>): boolean {
  return SURVEY_QUESTIONS.every(q => {
    const score = answers[q.key]
    return typeof score === 'number' && score >= 1 && score <= 5
  })
}

/**
 * The fixed set of context tags a student can pick after the scored questions —
 * "what's been on your mind" — not scored, never flag-eligible on its own. Its job
 * is to make a low score routable (coursework → tutor, home → DSL, health → physio).
 * Keep in sync with the DB check constraint in
 * supabase/migrations/065_wellbeing_context_tags.sql — this is the single source of
 * truth for both the student-facing picker and the admin badge display.
 */
export const CONTEXT_TAGS = [
  { key: 'football',       label: 'Football',        emoji: '⚽' },
  { key: 'college',        label: 'College work',    emoji: '📚' },
  { key: 'home',           label: 'Home',             emoji: '🏠' },
  { key: 'friends',        label: 'Friends',          emoji: '👥' },
  { key: 'money',          label: 'Money',            emoji: '💷' },
  { key: 'health',         label: 'Health or injury', emoji: '🩹' },
  { key: 'something_else', label: 'Something else',   emoji: '🤔' },
  { key: 'nothing_much',   label: 'Nothing much',     emoji: '🙂' },
] as const

export type ContextTagKey = typeof CONTEXT_TAGS[number]['key']

/** True if `tags` is at most 2 valid context-tag keys. Mirrors the DB check constraint. */
export function isValidContextTags(tags: unknown): tags is ContextTagKey[] {
  if (!Array.isArray(tags)) return false
  if (tags.length > 2) return false
  const validKeys = new Set<string>(CONTEXT_TAGS.map(t => t.key))
  return tags.every(t => typeof t === 'string' && validKeys.has(t))
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest wellbeingUtils -v`
Expected: PASS (all existing tests + new ones)

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/065_wellbeing_context_tags.sql lib/wellbeing/wellbeingUtils.ts __tests__/lib/wellbeing/wellbeingUtils.test.ts
git commit -m "feat(wellbeing): add connection question + context tag data

connection is added to SURVEY_QUESTIONS with its own label scale
(distinct from both the generic and stress scales, matching the
research's exact proposed wording) but deliberately NOT added to
RED_FLAG_KEYS — observation-only until there's a term's worth of real
data, per product-owner decision.

CONTEXT_TAGS (the 8-tag 'what's been on your mind' picker, not scored,
never flag-eligible) and its validator isValidContextTags are the
single source of truth shared by the submit route, student page, and
admin page in the following tasks — kept in sync with the new DB check
constraint (migration 065).

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

## Task 2: Submit route accepts and validates `context_tags`

**Files:**
- Modify: `app/api/wellbeing/submit/route.ts`
- Test: `__tests__/lib/wellbeing/submitRoute.test.ts`

**Interfaces:**
- Consumes: `isValidContextTags` from Task 1.

- [ ] **Step 1: Fix the stale fixture and write the failing tests**

In `__tests__/lib/wellbeing/submitRoute.test.ts`, first fix the now-incomplete fixture (it will start failing `validateSurveyAnswers` once `connection` is a required key — this must be fixed for the EXISTING tests to keep passing, not just for new tests to work). Change:

```ts
const VALID_ANSWERS = { mood: 5, sleep: 5, energy: 5, stress: 1, football_enjoyment: 5 }
```

to:

```ts
const VALID_ANSWERS = { mood: 5, sleep: 5, energy: 5, stress: 1, connection: 5, football_enjoyment: 5 }
```

Then change `setupSupabase` to expose its update mock so new tests can assert on it. Change:

```ts
/** Wires the user-scoped supabase client used for survey lookup/insert/update. */
function setupSupabase(opts: { surveyExists?: boolean; insertError?: { message: string } | null } = {}) {
  const { surveyExists = true, insertError = null } = opts

  supabaseFromMock.mockImplementation((table: string) => {
    if (table === 'wellbeing_surveys') {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: surveyExists ? { id: SURVEY_ID, status: 'open' } : null }),
              }),
            }),
          }),
        }),
        update: () => ({ eq: async () => ({ data: null, error: null }) }),
      }
    }
    if (table === 'wellbeing_responses') {
      return { insert: async () => ({ error: insertError }) }
    }
    throw new Error(`Unexpected table (supabase): ${table}`)
  })
}
```

to:

```ts
/** Wires the user-scoped supabase client used for survey lookup/insert/update. */
function setupSupabase(opts: { surveyExists?: boolean; insertError?: { message: string } | null } = {}) {
  const { surveyExists = true, insertError = null } = opts

  const updateMock = jest.fn(() => ({ eq: async () => ({ data: null, error: null }) }))

  supabaseFromMock.mockImplementation((table: string) => {
    if (table === 'wellbeing_surveys') {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: surveyExists ? { id: SURVEY_ID, status: 'open' } : null }),
              }),
            }),
          }),
        }),
        update: updateMock,
      }
    }
    if (table === 'wellbeing_responses') {
      return { insert: async () => ({ error: insertError }) }
    }
    throw new Error(`Unexpected table (supabase): ${table}`)
  })

  return { updateMock }
}
```

(The three existing call sites `setupSupabase()` / `setupSupabase({ surveyExists: false })` don't need to change — they simply don't use the new return value.)

Add these new tests at the end of the `describe('POST /api/wellbeing/submit', ...)` block:

```ts
  it('saves context_tags on the survey when provided', async () => {
    const { updateMock } = setupSupabase()
    setupAdmin()
    const res = await POST(makeRequest({
      survey_id: SURVEY_ID, answers: VALID_ANSWERS, notes: {}, context_tags: ['home', 'money'],
    }))
    expect(res.status).toBe(200)
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ context_tags: ['home', 'money'] }))
  })

  it('defaults context_tags to null when not provided', async () => {
    const { updateMock } = setupSupabase()
    setupAdmin()
    const res = await POST(makeRequest({ survey_id: SURVEY_ID, answers: VALID_ANSWERS, notes: {} }))
    expect(res.status).toBe(200)
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ context_tags: null }))
  })

  it('rejects more than 2 context_tags with 400', async () => {
    setupSupabase()
    const res = await POST(makeRequest({
      survey_id: SURVEY_ID, answers: VALID_ANSWERS, notes: {}, context_tags: ['home', 'money', 'friends'],
    }))
    expect(res.status).toBe(400)
  })

  it('rejects an unrecognized context tag with 400', async () => {
    setupSupabase()
    const res = await POST(makeRequest({
      survey_id: SURVEY_ID, answers: VALID_ANSWERS, notes: {}, context_tags: ['not-a-real-tag'],
    }))
    expect(res.status).toBe(400)
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest submitRoute -v`
Expected: FAIL — `context_tags` isn't read/validated/saved yet.

- [ ] **Step 3: Update the route**

In `app/api/wellbeing/submit/route.ts`, change the import:

```ts
import { validateSurveyAnswers, getRedFlags, SURVEY_QUESTIONS } from '@/lib/wellbeing/wellbeingUtils'
```

to:

```ts
import { validateSurveyAnswers, getRedFlags, isValidContextTags, SURVEY_QUESTIONS } from '@/lib/wellbeing/wellbeingUtils'
```

Change the body-parsing and validation block:

```ts
  const body = await request.json()
  const { survey_id, answers, notes } = body as {
    survey_id: string
    answers: Record<string, number>
    notes: Record<string, string>
  }

  if (!survey_id || !answers) {
    return NextResponse.json({ error: 'survey_id and answers required' }, { status: 400 })
  }

  if (!validateSurveyAnswers(answers)) {
    return NextResponse.json({ error: 'All 5 questions must be answered with scores 1-5' }, { status: 400 })
  }
```

to:

```ts
  const body = await request.json()
  const { survey_id, answers, notes, context_tags } = body as {
    survey_id: string
    answers: Record<string, number>
    notes: Record<string, string>
    context_tags?: unknown
  }

  if (!survey_id || !answers) {
    return NextResponse.json({ error: 'survey_id and answers required' }, { status: 400 })
  }

  if (!validateSurveyAnswers(answers)) {
    return NextResponse.json({ error: 'All questions must be answered with scores 1-5' }, { status: 400 })
  }

  if (context_tags !== undefined && !isValidContextTags(context_tags)) {
    return NextResponse.json({ error: 'context_tags must be at most 2 recognized tags' }, { status: 400 })
  }
```

Change the survey-completion update:

```ts
  // Mark survey complete
  await supabase
    .from('wellbeing_surveys')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', survey_id)
```

to:

```ts
  // Mark survey complete
  await supabase
    .from('wellbeing_surveys')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      context_tags: context_tags ?? null,
    })
    .eq('id', survey_id)
```

(The rest of the file — `notifyStaffOfRedFlag`, the response-insert block, the red-flag check — is unchanged.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest submitRoute -v`
Expected: PASS (all existing tests, now using the 6-key fixture, + 4 new tests)

- [ ] **Step 5: Commit**

```bash
git add app/api/wellbeing/submit/route.ts __tests__/lib/wellbeing/submitRoute.test.ts
git commit -m "feat(wellbeing): accept and validate context_tags on submit

Validates against isValidContextTags (max 2, recognized keys only) —
a clean 400 for a malformed request rather than a raw DB
constraint-violation 500. Saved on the same update call that already
marks the survey completed.

Also fixes VALID_ANSWERS in submitRoute.test.ts, which would otherwise
have started failing validateSurveyAnswers now that connection is a
required key.

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

## Task 3: Student page — chip-picker step and connection question

**Files:**
- Modify: `app/(student)/wellbeing/page.tsx`
- Test: `__tests__/app/wellbeing/WellbeingPage.test.tsx`

**Interfaces:**
- Consumes: `CONTEXT_TAGS` from Task 1.

- [ ] **Step 1: Write the failing tests**

Add to `__tests__/app/wellbeing/WellbeingPage.test.tsx`. First, add an import:

```ts
import { SURVEY_QUESTIONS } from '@/lib/wellbeing/wellbeingUtils'
```

Then add this new describe block at the end of the file:

```tsx
async function advanceToChipStep() {
  openSurveyMaybeSingleMock.mockResolvedValueOnce({ data: { id: 'survey-1' } })
  render(<WellbeingPage />)
  for (let i = 0; i < SURVEY_QUESTIONS.length; i++) {
    const scoreButtons = await screen.findAllByRole('button', { name: '4' })
    fireEvent.click(scoreButtons[0])
    fireEvent.click(screen.getByText('Next'))
  }
}

describe('WellbeingPage — context chip picker', () => {
  beforeEach(() => {
    global.fetch = jest.fn(() => Promise.resolve({ ok: true } as Response)) as unknown as typeof fetch
  })

  it('shows the chip-picker screen after the last scored question', async () => {
    await advanceToChipStep()
    expect(await screen.findByText("What's been on your mind most this week?")).toBeInTheDocument()
  })

  it('does not allow selecting more than 2 tags', async () => {
    await advanceToChipStep()
    fireEvent.click(await screen.findByText(/Football/))
    fireEvent.click(screen.getByText(/College work/))
    const thirdTag = screen.getByText(/^Home$/).closest('button')
    expect(thirdTag).toBeDisabled()
  })

  it('submits successfully with zero tags selected (skip)', async () => {
    await advanceToChipStep()
    fireEvent.click(await screen.findByText('Submit ✓'))
    expect(await screen.findByText('Thanks for checking in 💙')).toBeInTheDocument()
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/wellbeing/submit',
      expect.objectContaining({ body: expect.stringContaining('"context_tags":[]') }),
    )
  })

  it('shows the updated time estimate', async () => {
    render(<WellbeingPage />)
    expect(await screen.findByText(/90 seconds/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest WellbeingPage -v`
Expected: FAIL — there is no chip-picker step yet, and the header still says "60 seconds".

- [ ] **Step 3: Update the page**

Replace the full contents of `app/(student)/wellbeing/page.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import {
  SURVEY_QUESTIONS,
  getScoreLabel,
  buildWellbeingTrend,
  CONTEXT_TAGS,
  type SurveyTrendPoint,
} from '@/lib/wellbeing/wellbeingUtils'
import { WellbeingTrendChart } from '@/components/wellbeing/WellbeingTrendChart'
import { CheckCircle2, ChevronRight } from 'lucide-react'

export default function WellbeingPage() {
  const [view, setView] = useState<'checkin' | 'trend'>('checkin')
  const [survey, setSurvey] = useState<{ id: string } | null | undefined>(undefined)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [contextTags, setContextTags] = useState<string[]>([])
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [trendData, setTrendData] = useState<SurveyTrendPoint[] | undefined>(undefined)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return setSurvey(null)
      supabase
        .from('wellbeing_surveys')
        .select('id')
        .eq('student_id', user.id)
        .eq('status', 'open')
        .order('sent_at', { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data }) => setSurvey(data))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (view !== 'trend' || trendData !== undefined) return
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return setTrendData([])
      supabase
        .from('wellbeing_surveys')
        .select('sent_at, wellbeing_responses(question_key, score)')
        .eq('student_id', user.id)
        .eq('status', 'completed')
        .order('sent_at', { ascending: false })
        .limit(10)
        .then(({ data }) => {
          const rows = (data ?? []) as {
            sent_at: string
            wellbeing_responses: { question_key: string; score: number }[]
          }[]
          setTrendData(buildWellbeingTrend([...rows].reverse()))
        })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view])

  async function handleSubmit() {
    if (!survey) return
    setSubmitting(true)
    setError('')
    const res = await fetch('/api/wellbeing/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ survey_id: survey.id, answers, notes, context_tags: contextTags }),
    })
    if (res.ok) {
      setDone(true)
    } else {
      const d = await res.json()
      setError(d.error ?? 'Something went wrong')
    }
    setSubmitting(false)
  }

  function toggleTag(tagKey: string) {
    setContextTags(prev => {
      if (prev.includes(tagKey)) return prev.filter(t => t !== tagKey)
      if (prev.length >= 2) return prev
      return [...prev, tagKey]
    })
  }

  let checkinBody: JSX.Element
  if (survey === undefined) {
    checkinBody = <p className="text-center text-muted-foreground py-12">Loading...</p>
  } else if (survey === null) {
    checkinBody = (
      <div className="text-center py-12 space-y-2">
        <p className="text-2xl">✅</p>
        <p className="font-semibold text-gray-800">No survey open right now</p>
        <p className="text-sm text-muted-foreground">Your next check-in will arrive on a Monday.</p>
      </div>
    )
  } else if (done) {
    checkinBody = (
      <div className="text-center py-12 space-y-3">
        <CheckCircle2 size={48} className="text-emerald-500 mx-auto" />
        <p className="text-xl font-bold text-gray-900">Thanks for checking in 💙</p>
        <p className="text-sm text-muted-foreground">Your responses have been saved. See you next week.</p>
      </div>
    )
  } else {
    const isChipStep = step === SURVEY_QUESTIONS.length
    const q = isChipStep ? null : SURVEY_QUESTIONS[step]
    const isLast = isChipStep
    const canAdvance = isChipStep ? true : answers[q!.key] !== undefined

    checkinBody = (
      <div className="space-y-6">
        {/* Progress — one segment per scored question, plus one for the chip screen */}
        <div className="flex gap-1.5">
          {[...SURVEY_QUESTIONS, null].map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i < step ? 'bg-tranmere-blue' : i === step ? 'bg-tranmere-blue/50' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>

        {isChipStep ? (
          <div className="rounded-2xl bg-white border border-gray-200 p-6 space-y-5 shadow-sm">
            <div className="text-center space-y-2">
              <p className="text-4xl">🤔</p>
              <p className="text-base font-semibold text-gray-900">What's been on your mind most this week?</p>
              <p className="text-xs text-muted-foreground">Pick up to two — or skip</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              {CONTEXT_TAGS.map(tag => (
                <button
                  key={tag.key}
                  onClick={() => toggleTag(tag.key)}
                  disabled={!contextTags.includes(tag.key) && contextTags.length >= 2}
                  className={`rounded-xl border-2 px-3 py-2 text-sm font-semibold transition-all disabled:opacity-40 ${
                    contextTags.includes(tag.key)
                      ? 'border-tranmere-blue bg-tranmere-blue text-white'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-tranmere-blue/50'
                  }`}
                >
                  {tag.emoji} {tag.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-white border border-gray-200 p-6 space-y-5 shadow-sm">
            <div className="text-center space-y-2">
              <p className="text-4xl">{q!.emoji}</p>
              <p className="text-base font-semibold text-gray-900">{q!.label}</p>
              <p className="text-xs text-muted-foreground">
                Question {step + 1} of {SURVEY_QUESTIONS.length}
              </p>
            </div>

            {/* Score buttons */}
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map(score => (
                <button
                  key={score}
                  onClick={() => setAnswers(a => ({ ...a, [q!.key]: score }))}
                  className={`flex flex-col items-center gap-1 rounded-xl py-3 border-2 transition-all text-sm font-bold ${
                    answers[q!.key] === score
                      ? 'border-tranmere-blue bg-tranmere-blue text-white shadow-md scale-105'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-tranmere-blue/50'
                  }`}
                >
                  {score}
                </button>
              ))}
            </div>

            {/* Score label */}
            {canAdvance && (
              <p className="text-center text-sm text-muted-foreground">
                {getScoreLabel(q!.key, answers[q!.key])}
              </p>
            )}

            {/* Optional note */}
            <div>
              <textarea
                placeholder="Any notes? (optional)"
                value={notes[q!.key] ?? ''}
                onChange={e => setNotes(n => ({ ...n, [q!.key]: e.target.value }))}
                rows={2}
                className="w-full text-sm rounded-xl border border-gray-200 px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-tranmere-blue/30"
              />
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-600 text-center">{error}</p>}

        {/* Navigation */}
        <div className="flex gap-3">
          {step > 0 && (
            <button
              onClick={() => setStep(s => s - 1)}
              className="flex-1 py-3 rounded-2xl border border-gray-200 text-sm font-semibold text-gray-700"
            >
              Back
            </button>
          )}
          {isLast ? (
            <button
              disabled={submitting}
              onClick={handleSubmit}
              className="flex-1 py-3 rounded-2xl bg-tranmere-blue text-white text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {submitting ? 'Submitting…' : 'Submit ✓'}
            </button>
          ) : (
            <button
              disabled={!canAdvance}
              onClick={() => setStep(s => s + 1)}
              className="flex-1 py-3 rounded-2xl bg-tranmere-blue text-white text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-2"
            >
              Next <ChevronRight size={15} />
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto space-y-4 py-4">
      {/* Header — now shown for every state, not only the form (previously the
          loading/idle/done states had no title at all) */}
      <div>
        <h1 className="text-xl font-bold text-tranmere-blue">Wellbeing Check-in</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Takes about 90 seconds · Every week</p>
      </div>

      {/* View toggle */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setView('checkin')}
          className={`px-3 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${
            view === 'checkin' ? 'border-tranmere-blue text-tranmere-blue' : 'border-transparent text-muted-foreground'
          }`}
        >
          Check-in
        </button>
        <button
          onClick={() => setView('trend')}
          className={`px-3 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${
            view === 'trend' ? 'border-tranmere-blue text-tranmere-blue' : 'border-transparent text-muted-foreground'
          }`}
        >
          My Trend
        </button>
      </div>

      {view === 'trend' ? (
        trendData === undefined ? (
          <p className="text-center text-muted-foreground py-12">Loading...</p>
        ) : (
          <WellbeingTrendChart data={trendData} />
        )
      ) : (
        checkinBody
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest WellbeingPage -v`
Expected: PASS (existing 3 tests + 4 new ones)

- [ ] **Step 5: Commit**

```bash
git add "app/(student)/wellbeing/page.tsx" __tests__/app/wellbeing/WellbeingPage.test.tsx
git commit -m "feat(wellbeing): add context chip-picker step to the check-in flow

The chip picker is a new final step after the (now 6) scored
questions — step index SURVEY_QUESTIONS.length, distinct from the
scored-question steps, matching the research's 'one screen, no score'
design. Max 2 tags enforced client-side (mirrors the DB constraint and
submit-route validation from the previous two tasks); zero tags is a
valid skip. Time estimate updated 60s -> 90s to stay honest about the
now-longer flow.

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

## Task 4: Admin page displays context tags

**Files:**
- Modify: `app/(admin)/admin/wellbeing/page.tsx`

**Interfaces:**
- Consumes: `CONTEXT_TAGS` from Task 1.

- [ ] **Step 1: Update the page**

In `app/(admin)/admin/wellbeing/page.tsx`, change the import:

```tsx
import { getRedFlags, buildWellbeingTrend, normalizedScore, SURVEY_QUESTIONS } from '@/lib/wellbeing/wellbeingUtils'
```

to:

```tsx
import { getRedFlags, buildWellbeingTrend, normalizedScore, CONTEXT_TAGS, SURVEY_QUESTIONS } from '@/lib/wellbeing/wellbeingUtils'
```

Change the surveys query to include `context_tags`:

```tsx
  const { data: surveys } = await admin
    .from('wellbeing_surveys')
    .select(`
      id, sent_at, completed_at, status,
      users!student_id(name),
      wellbeing_responses(question_key, score, note)
    `)
    .order('sent_at', { ascending: false })
    .limit(200)

  type Survey = {
    id: string
    sent_at: string
    completed_at: string | null
    status: string
    users: { name: string } | null
    wellbeing_responses: { question_key: string; score: number; note: string | null }[]
  }
```

to:

```tsx
  const { data: surveys } = await admin
    .from('wellbeing_surveys')
    .select(`
      id, sent_at, completed_at, status, context_tags,
      users!student_id(name),
      wellbeing_responses(question_key, score, note)
    `)
    .order('sent_at', { ascending: false })
    .limit(200)

  type Survey = {
    id: string
    sent_at: string
    completed_at: string | null
    status: string
    context_tags: string[] | null
    users: { name: string } | null
    wellbeing_responses: { question_key: string; score: number; note: string | null }[]
  }
```

Change the score grid from 5 to 6 columns (there are now 6 `SURVEY_QUESTIONS`):

```tsx
                {survey.wellbeing_responses.length > 0 && (
                  <div className="grid grid-cols-5 gap-1.5">
```

to:

```tsx
                {survey.wellbeing_responses.length > 0 && (
                  <div className="grid grid-cols-6 gap-1.5">
```

Add a context-tag badge block, placed after the score grid's closing `)}` and before the existing Notes block:

```tsx
                {/* Context tags — "what's been on your mind" picker, not scored */}
                {survey.context_tags && survey.context_tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {survey.context_tags.map(tagKey => {
                      const tag = CONTEXT_TAGS.find(t => t.key === tagKey)
                      return (
                        <span
                          key={tagKey}
                          className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-tranmere-blue text-xs font-medium px-2.5 py-1"
                        >
                          {tag?.emoji} {tag?.label ?? tagKey}
                        </span>
                      )
                    })}
                  </div>
                )}
```

(The rest of the file — grouping logic, red-flag rendering, notes block — is unchanged.)

- [ ] **Step 2: Run the full suite and type-check**

Run: `npx jest --silent`
Expected: PASS, total test count = pre-Task-1 baseline + (Task 1's new tests) + (Task 2's new tests) + (Task 3's new tests) — Task 4 adds none.

Run: `npx tsc --noEmit 2>&1 | grep -v __tests__`
Expected: no new errors outside `__tests__/`

- [ ] **Step 3: Commit**

```bash
git add "app/(admin)/admin/wellbeing/page.tsx"
git commit -m "feat(wellbeing): show context tags on the admin wellbeing view

Score grid widens from 5 to 6 columns for the new connection question
(renders automatically — it's just another SURVEY_QUESTIONS entry, no
special-casing needed). Context tags render as small badges near the
notes block, giving staff the 'why' behind a low score.

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

## Self-Review

**Spec coverage:**
- Migration, additive, no backfill → Task 1. ✅
- `connection` question + own label scale, NOT flag-eligible → Task 1. ✅
- `CONTEXT_TAGS` single source of truth, matches migration's allowed set → Task 1, verified by its own drift-guard test. ✅
- Submit route validates + saves `context_tags` → Task 2. ✅
- Student page: chip-picker as final step, time estimate updated → Task 3. ✅
- Admin page: tags displayed, grid widened → Task 4. ✅
- No free-text consolidation, no stress→calm rename → neither present anywhere in this plan. ✅
- Stale `VALID_ANSWERS` fixture fixed proactively → Task 2, Step 1. ✅

**Placeholder scan:** No TBD/TODO; every step has complete, copy-pasteable code.

**Type consistency:** `CONTEXT_TAGS`/`ContextTagKey`/`isValidContextTags` (Task 1) are consumed identically in Task 2 (validation), Task 3 (`tag.key`/`tag.label`/`tag.emoji` rendering), and Task 4 (`CONTEXT_TAGS.find(t => t.key === tagKey)`) — same shape throughout. `context_tags: string[] | null` matches between the submit route's save and the admin page's read type.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-10-checkin-context-and-connection.md`. Two execution options:

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks.
2. **Inline Execution** — execute in this session with checkpoints for review.

Which approach?
