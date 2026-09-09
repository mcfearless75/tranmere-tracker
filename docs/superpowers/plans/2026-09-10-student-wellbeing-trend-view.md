# Student Wellbeing Trend View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a student see their own overall wellbeing trend (last ~10 completed check-ins) on the existing `/wellbeing` page, via a new tab alongside the check-in itself.

**Architecture:** One new presentational component (`WellbeingTrendChart`, reusing the existing `buildWellbeingTrend` logic) plus a restructure of `app/(student)/wellbeing/page.tsx` to add a persistent view toggle above the existing check-in state machine (loading/idle/done/form), which stays otherwise behaviorally unchanged. No schema, migration, or RLS change — confirmed unnecessary; students already have `select` access to their own full survey history.

**Tech Stack:** React (Client Component), Supabase JS (`@supabase/ssr` browser client), recharts (already a dependency), Jest + Testing Library.

## Global Constraints

- No schema/migration/RLS change — students already have unrestricted `select` on their own `wellbeing_surveys`/`wellbeing_responses` rows regardless of status (`supabase/migrations/023_wellbeing.sql`). (design spec)
- Scoped to overall trend only — no per-question breakdown, no notes-read-back. Both explicitly deferred. (design spec, product-owner decision)
- No change to survey questions, red-flag thresholds, or safeguarding logic. (design spec)
- Recharts component tests must follow this repo's established convention (`__tests__/components/charts/AttendanceBar.test.tsx`): mock `recharts`'s `ResponsiveContainer` to render children directly, stub `global.ResizeObserver`.
- TypeScript strict — no `any` without justification.

---

## File Structure

| File | Change |
|---|---|
| `components/wellbeing/WellbeingTrendChart.tsx` (new) | Full-size trend chart (distinct from the existing tiny `WellbeingSparkline`, a different job) — renders an empty state for <2 points, a dated line chart for 2+. |
| `__tests__/components/wellbeing/WellbeingTrendChart.test.tsx` (new) | Empty-state at 0 and 1 points; renders a chart (not the empty state) at 2+ points. |
| `app/(student)/wellbeing/page.tsx` (modified) | Adds a `view: 'checkin' \| 'trend'` toggle above the existing state machine; adds the completed-surveys fetch for the trend tab. Existing check-in behavior (loading/idle/done/form) unchanged in substance — converted from early `return`s to an assigned `checkinBody` variable so the toggle can render alongside any of those states, not just the form. One small, deliberate side effect: the page title ("Wellbeing Check-in" / "Takes about 60 seconds · Every week") now shows in every state instead of only during the form — previously the loading/idle/done states had no title at all, which this incidentally fixes. |
| `__tests__/app/wellbeing/WellbeingPage.test.tsx` (new) | Focused on the new behavior only: switching to "My Trend" fetches completed surveys with the right filters and passes the computed trend to `WellbeingTrendChart` (mocked as a stub — it has its own dedicated test above, no need to re-test recharts rendering here); switching tabs preserves in-progress check-in form state (true by construction — `view` is separate state on the same component instance, no remount — proven by a test, not left as an open question). |

---

## Task 1: Trend chart component

**Files:**
- Create: `components/wellbeing/WellbeingTrendChart.tsx`
- Test: `__tests__/components/wellbeing/WellbeingTrendChart.test.tsx`

**Interfaces:**
- Produces: `WellbeingTrendChart({ data: SurveyTrendPoint[] })` — `SurveyTrendPoint` is the existing exported type from `lib/wellbeing/wellbeingUtils.ts` (`{ sentAt: string; avg: number }`), not redefined. Used by Task 2.

- [ ] **Step 1: Write the failing test**

Create `__tests__/components/wellbeing/WellbeingTrendChart.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { WellbeingTrendChart } from '@/components/wellbeing/WellbeingTrendChart'

// Same convention as __tests__/components/charts/AttendanceBar.test.tsx
jest.mock('recharts', () => {
  const actual = jest.requireActual('recharts')
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  }
})

global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

describe('WellbeingTrendChart', () => {
  it('shows an empty-state message with 0 data points', () => {
    render(<WellbeingTrendChart data={[]} />)
    expect(screen.getByText(/complete a couple more check-ins/i)).toBeInTheDocument()
  })

  it('shows an empty-state message with only 1 data point', () => {
    render(<WellbeingTrendChart data={[{ sentAt: '2026-09-01T00:00:00Z', avg: 4 }]} />)
    expect(screen.getByText(/complete a couple more check-ins/i)).toBeInTheDocument()
  })

  it('renders a chart (not the empty state) with 2+ data points', () => {
    render(<WellbeingTrendChart data={[
      { sentAt: '2026-08-25T00:00:00Z', avg: 3.5 },
      { sentAt: '2026-09-01T00:00:00Z', avg: 4.2 },
    ]} />)
    expect(screen.queryByText(/complete a couple more check-ins/i)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest WellbeingTrendChart -v`
Expected: FAIL with "Cannot find module '@/components/wellbeing/WellbeingTrendChart'"

- [ ] **Step 3: Write the implementation**

Create `components/wellbeing/WellbeingTrendChart.tsx`:

```tsx
'use client'

import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import type { SurveyTrendPoint } from '@/lib/wellbeing/wellbeingUtils'

interface Props {
  data: SurveyTrendPoint[]
}

export function WellbeingTrendChart({ data }: Props) {
  if (data.length < 2) {
    return (
      <p className="text-center text-sm text-muted-foreground py-12">
        Complete a couple more check-ins to see your trend appear here.
      </p>
    )
  }

  const chartData = data.map(d => ({
    ...d,
    label: new Date(d.sentAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
  }))

  return (
    <div className="h-56 w-full" title="Your wellbeing trend">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis domain={[1, 5]} tick={{ fontSize: 11 }} allowDecimals={false} />
          <Tooltip formatter={(v) => [`${v}/5`, 'Avg']} labelFormatter={(label) => label} />
          <Line type="monotone" dataKey="avg" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest WellbeingTrendChart -v`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add components/wellbeing/WellbeingTrendChart.tsx __tests__/components/wellbeing/WellbeingTrendChart.test.tsx
git commit -m "feat(wellbeing): add student-facing trend chart component

Full-size chart for a dedicated student view — distinct from the
existing 80x32px WellbeingSparkline (a different job: compact admin
list-row indicator). Reuses the existing SurveyTrendPoint type and
buildWellbeingTrend logic as-is, no duplication.

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

## Task 2: Wire the trend view into the student wellbeing page

**Files:**
- Modify: `app/(student)/wellbeing/page.tsx` (full-file replacement — the change restructures the component, shown in full below)
- Test: `__tests__/app/wellbeing/WellbeingPage.test.tsx`

**Interfaces:**
- Consumes: `WellbeingTrendChart` from Task 1, `buildWellbeingTrend` and `SurveyTrendPoint` (both already exported from `lib/wellbeing/wellbeingUtils.ts`, unchanged).

- [ ] **Step 1: Write the failing test**

Create `__tests__/app/wellbeing/WellbeingPage.test.tsx`:

```tsx
/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import WellbeingPage from '@/app/(student)/wellbeing/page'

const STUDENT_ID = 'student-1'

jest.mock('@/components/wellbeing/WellbeingTrendChart', () => ({
  // Stub — this component has its own dedicated test (Task 1). Here we only
  // need to verify the PAGE fetches the right data and passes it through.
  WellbeingTrendChart: ({ data }: { data: unknown }) => (
    <div data-testid="trend-chart">{JSON.stringify(data)}</div>
  ),
}))

const getUserMock = jest.fn(() => Promise.resolve({ data: { user: { id: STUDENT_ID } } }))
const openSurveyMaybeSingleMock = jest.fn(() => Promise.resolve({ data: null })) // no open survey by default
const completedSurveysMock = jest.fn(() => Promise.resolve({ data: [] }))

jest.mock('@supabase/ssr', () => ({
  createBrowserClient: () => ({
    auth: { getUser: getUserMock },
    from: (table: string) => {
      if (table !== 'wellbeing_surveys') throw new Error(`Unexpected table: ${table}`)
      return {
        select: (cols: string) => {
          if (cols === 'id') {
            return {
              eq: () => ({
                eq: () => ({
                  order: () => ({
                    limit: () => ({ maybeSingle: openSurveyMaybeSingleMock }),
                  }),
                }),
              }),
            }
          }
          // completed-surveys trend query
          return {
            eq: () => ({
              eq: () => ({
                order: () => ({
                  limit: completedSurveysMock,
                }),
              }),
            }),
          }
        },
      }
    },
  }),
}))

beforeEach(() => {
  getUserMock.mockClear()
  openSurveyMaybeSingleMock.mockClear()
  completedSurveysMock.mockClear()
})

describe('WellbeingPage — trend tab', () => {
  it('does not fetch completed surveys until the "My Trend" tab is opened', async () => {
    render(<WellbeingPage />)
    await waitFor(() => expect(openSurveyMaybeSingleMock).toHaveBeenCalled())
    expect(completedSurveysMock).not.toHaveBeenCalled()
  })

  it('fetches completed surveys and passes the computed trend to WellbeingTrendChart', async () => {
    completedSurveysMock.mockResolvedValueOnce({
      data: [
        { sent_at: '2026-09-01T00:00:00Z', wellbeing_responses: [{ question_key: 'mood', score: 4 }] },
        { sent_at: '2026-08-25T00:00:00Z', wellbeing_responses: [{ question_key: 'mood', score: 3 }] },
      ],
    })
    render(<WellbeingPage />)
    await waitFor(() => expect(openSurveyMaybeSingleMock).toHaveBeenCalled())
    fireEvent.click(screen.getByText('My Trend'))
    await waitFor(() => expect(completedSurveysMock).toHaveBeenCalledTimes(1))
    const chart = await screen.findByTestId('trend-chart')
    // Oldest-first after buildWellbeingTrend: 25 Aug (score 3) then 01 Sep (score 4)
    expect(chart.textContent).toContain('"avg":3')
    expect(chart.textContent).toContain('"avg":4')
  })

  it('preserves in-progress check-in state when switching tabs away and back', async () => {
    openSurveyMaybeSingleMock.mockResolvedValueOnce({ data: { id: 'survey-1' } })
    render(<WellbeingPage />)
    // Wait for the form to appear (first question) and select a score.
    const scoreButtons = await screen.findAllByRole('button', { name: '5' })
    fireEvent.click(scoreButtons[0])

    fireEvent.click(screen.getByText('My Trend'))
    await screen.findByTestId('trend-chart')
    fireEvent.click(screen.getByText('Check-in'))

    // The previously-selected score for the first question is still selected —
    // proven by the score label rendering, not just the button's own state.
    expect(await screen.findByText('Great')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest WellbeingPage -v`
Expected: FAIL — there is no "My Trend" tab yet, and the page has no second query for completed surveys.

- [ ] **Step 3: Replace the full contents of `app/(student)/wellbeing/page.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import {
  SURVEY_QUESTIONS,
  getScoreLabel,
  buildWellbeingTrend,
  type SurveyTrendPoint,
} from '@/lib/wellbeing/wellbeingUtils'
import { WellbeingTrendChart } from '@/components/wellbeing/WellbeingTrendChart'
import { CheckCircle2, ChevronRight } from 'lucide-react'

export default function WellbeingPage() {
  const [view, setView] = useState<'checkin' | 'trend'>('checkin')
  const [survey, setSurvey] = useState<{ id: string } | null | undefined>(undefined)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
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
      body: JSON.stringify({ survey_id: survey.id, answers, notes }),
    })
    if (res.ok) {
      setDone(true)
    } else {
      const d = await res.json()
      setError(d.error ?? 'Something went wrong')
    }
    setSubmitting(false)
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
    const q = SURVEY_QUESTIONS[step]
    const isLast = step === SURVEY_QUESTIONS.length - 1
    const canAdvance = answers[q.key] !== undefined

    checkinBody = (
      <div className="space-y-6">
        {/* Progress */}
        <div className="flex gap-1.5">
          {SURVEY_QUESTIONS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i < step ? 'bg-tranmere-blue' : i === step ? 'bg-tranmere-blue/50' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>

        {/* Question card */}
        <div className="rounded-2xl bg-white border border-gray-200 p-6 space-y-5 shadow-sm">
          <div className="text-center space-y-2">
            <p className="text-4xl">{q.emoji}</p>
            <p className="text-base font-semibold text-gray-900">{q.label}</p>
            <p className="text-xs text-muted-foreground">
              Question {step + 1} of {SURVEY_QUESTIONS.length}
            </p>
          </div>

          {/* Score buttons */}
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map(score => (
              <button
                key={score}
                onClick={() => setAnswers(a => ({ ...a, [q.key]: score }))}
                className={`flex flex-col items-center gap-1 rounded-xl py-3 border-2 transition-all text-sm font-bold ${
                  answers[q.key] === score
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
              {getScoreLabel(q.key, answers[q.key])}
            </p>
          )}

          {/* Optional note */}
          <div>
            <textarea
              placeholder="Any notes? (optional)"
              value={notes[q.key] ?? ''}
              onChange={e => setNotes(n => ({ ...n, [q.key]: e.target.value }))}
              rows={2}
              className="w-full text-sm rounded-xl border border-gray-200 px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-tranmere-blue/30"
            />
          </div>
        </div>

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
              disabled={!canAdvance || submitting}
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
        <p className="text-xs text-muted-foreground mt-0.5">Takes about 60 seconds · Every week</p>
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

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest WellbeingPage -v`
Expected: PASS (3 tests)

- [ ] **Step 5: Run the full suite and type-check**

Run: `npx jest --silent`
Expected: PASS, total test count = pre-task baseline + 6 (3 from Task 1 + 3 from Task 2)

Run: `npx tsc --noEmit 2>&1 | grep -v __tests__`
Expected: no new errors outside `__tests__/`

- [ ] **Step 6: Commit**

```bash
git add "app/(student)/wellbeing/page.tsx" __tests__/app/wellbeing/WellbeingPage.test.tsx
git commit -m "feat(wellbeing): add student-facing trend tab to the check-in page

Students can now see their own overall wellbeing trend (last 10
completed check-ins) via a new tab alongside the check-in itself —
addresses the reciprocity finding from tonight's research (both
reports independently found that teens answer honestly when they can
see answering changed something; right now a student submits and only
ever sees a one-off thank-you). No schema/RLS change needed — students
already have unrestricted read access to their own survey history.

Restructured the existing loading/idle/done/form states from early
returns into an assigned variable so the new tab bar can render
alongside any of them, not just the form. Behaviorally unchanged
otherwise, with one small deliberate side effect: the page title now
shows in every state (previously only during the form).

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

## Self-Review

**Spec coverage:**
- No schema/RLS change → confirmed nowhere in this plan. ✅
- Overall trend only, no per-question breakdown, no notes-read-back → `WellbeingTrendChart` takes only `SurveyTrendPoint[]` (composite avg), nothing else. ✅
- New tab on existing `/wellbeing` page, last ~10 check-ins → Task 2, `.limit(10)`. ✅
- Reuses `buildWellbeingTrend`, doesn't duplicate it → Task 2 imports and calls it directly. ✅
- Empty state for <2 points → Task 1. ✅
- Recharts testing convention followed → Task 1, matches `AttendanceBar.test.tsx` exactly. ✅
- State-preservation question the spec flagged as needing confirmation → resolved by construction (single component instance, `view` is just one more piece of state) and proven by Task 2's third test, not left open.

**Placeholder scan:** No TBD/TODO; both tasks have complete, copy-pasteable code.

**Type consistency:** `WellbeingTrendChart({ data: SurveyTrendPoint[] })` (Task 1) matches its only call site in Task 2 (`<WellbeingTrendChart data={trendData} />` where `trendData: SurveyTrendPoint[] | undefined`, only rendered once narrowed to defined) exactly.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-10-student-wellbeing-trend-view.md`. Two execution options:

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks.
2. **Inline Execution** — execute in this session with checkpoints for review.

Which approach?
