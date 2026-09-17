import { render, screen, within } from '@testing-library/react'

// ─── Supabase server client stub ──────────────────────────────────────────
//
// The dashboard page is an async server component that fires ~15 parallel
// Supabase queries (Promise.all) plus one profile lookup. Rather than mock
// each query's exact filter chain, this builds a generic per-table FIFO
// queue: `.from(table)` returns a chainable stub whose select/eq/gte/lte/
// order/limit all no-op and return itself, and whose maybeSingle/single/
// then all resolve to the next queued `{ data }` for that table — matching
// however the real page happens to call it.
//
// Every identifier the jest.mock factory below reaches out to is named
// with a `mock` prefix — babel-plugin-jest-hoist's documented escape hatch
// for "the mock is required lazily" (true here: `createClient()` isn't
// actually called until the page component body runs, well after this
// file's own top-level assignments have completed).
let mockProfileRow: Record<string, unknown> | null = null
let mockTableQueues: Record<string, Array<{ data: unknown; error?: unknown }>> = {}

function mockNextFor(table: string) {
  const queue = mockTableQueues[table]
  if (!queue || queue.length === 0) return { data: null, error: null }
  return queue.shift()!
}

function mockBuilder(table: string) {
  const result = table === 'users' ? { data: mockProfileRow, error: null } : mockNextFor(table)
  const chain: Record<string, unknown> = {}
  for (const method of ['select', 'eq', 'gte', 'lte', 'order', 'limit']) {
    chain[method] = () => chain
  }
  chain.maybeSingle = () => Promise.resolve(result)
  chain.single = () => Promise.resolve(result)
  chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject)
  return chain
}

function mockGetUser() {
  return Promise.resolve({ data: { user: { id: 'student-1' } } })
}

jest.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
    from: (table: string) => mockBuilder(table),
  }),
}))

// Heavy 'use client' components with their own dedicated coverage — the
// dashboard page test only needs to verify THIS page renders them in the
// right place, not their internal behaviour (same convention as
// __tests__/app/wellbeing/WellbeingPage.test.tsx stubbing WellbeingTrendChart).
jest.mock('@/components/attendance/PhaseDayCard', () => ({
  PhaseDayCard: () => <div data-testid="phase-day-card-stub" />,
}))
jest.mock('@/components/charts/StudentCharts', () => ({
  StudentCharts: () => <div data-testid="student-charts-stub" />,
}))
jest.mock('@/components/PushOptIn', () => ({
  PushOptIn: () => <div data-testid="push-opt-in-stub" />,
}))

import DashboardPage from '@/app/(student)/dashboard/page'

function resetMockFixtures() {
  mockProfileRow = {
    name: 'Alex Test',
    course_id: null,
    avatar_url: 'https://example.com/avatar.png',
    courses: null,
    must_change_pin: false,
    year_group: null, // keeps the timetable_slots query out of the picture
    date_of_birth: '2008-01-01',
    position: 'CM',
    height_cm: 175,
    weight_kg: 70,
    build: 'medium',
    dominant_foot: 'right',
  }
  mockTableQueues = {
    nutrition_logs: [{ data: [] }],
    match_squads: [{ data: [] }],
    training_logs: [{ data: null }],
    // today, tomorrow, scheduledDays (30d), chartScheduled (56d)
    attendance_sessions: [{ data: [] }, { data: [] }, { data: [] }, { data: [] }],
    // todayDaily, attendedDays (30d), chartAttended (56d)
    daily_attendance: [{ data: null }, { data: [] }, { data: [] }],
    ai_player_reports: [{ data: null }],
    wellbeing_surveys: [{ data: null }],
    academy_settings: [{ data: null }],
    attendance_excusals: [{ data: null }],
  }
}

async function renderDashboard() {
  const element = await DashboardPage()
  return render(element)
}

beforeEach(() => {
  resetMockFixtures()
})

describe('Student dashboard — slimmed layout (Task B)', () => {
  it('shows PhaseDayCard by default, and keeps "My Tools" collapsed inside the More disclosure', async () => {
    const { container } = await renderDashboard()

    // PhaseDayCard renders unconditionally, above the fold.
    expect(screen.getByTestId('phase-day-card-stub')).toBeInTheDocument()

    // The "My Tools" mosaic must not render outside a collapsed disclosure.
    const details = container.querySelector('details')
    expect(details).not.toBeNull()
    expect(details).not.toHaveAttribute('open')

    const myTools = within(details as HTMLElement).getByText('My Tools')
    expect(myTools).toBeInTheDocument()

    // And it must NOT also appear outside of that <details> element.
    const myToolsOutsideDetails = Array.from(container.querySelectorAll('p')).filter(
      p => p.textContent === 'My Tools' && !details!.contains(p)
    )
    expect(myToolsOutsideDetails).toHaveLength(0)

    // PushOptIn stays after the disclosure, unchanged.
    expect(screen.getByTestId('push-opt-in-stub')).toBeInTheDocument()
  })

  it('shows a single empty-state message in "Next up" when session/wellbeing/fixture are all empty', async () => {
    // Fixtures are already all-empty by default (resetMockFixtures) — no
    // today session, no open wellbeing survey, no upcoming squad entry.
    await renderDashboard()

    // Scope to the "Next up" block itself — the page's collapsed "More"
    // section (unaffected by this fixture) legitimately has its own,
    // unrelated "No sessions today — day off" copy in the itinerary hero.
    const nextUpHeading = screen.getByText('Next up')
    const nextUpBlock = nextUpHeading.closest('div')!.parentElement as HTMLElement
    expect(nextUpBlock).not.toBeNull()

    expect(within(nextUpBlock).getByText('Nothing due right now')).toBeInTheDocument()
    // Only the one shared empty-state message — no per-category row markup.
    expect(within(nextUpBlock).queryByText('Wellbeing check-in ready')).not.toBeInTheDocument()
  })

  it('shows a compact "Next up" row for an open wellbeing survey, without the empty-state message', async () => {
    mockTableQueues.wellbeing_surveys = [{ data: { id: 'survey-1' } }]
    await renderDashboard()

    expect(screen.getByText('Wellbeing check-in ready')).toBeInTheDocument()
    expect(screen.queryByText('Nothing due right now')).not.toBeInTheDocument()
  })
})
