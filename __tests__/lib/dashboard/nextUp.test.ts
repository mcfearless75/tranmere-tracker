import { buildNextUpRows } from '@/lib/dashboard/nextUp'

// Fixed "now" so tests aren't sensitive to when they run.
const NOW = new Date('2026-09-17T09:00:00.000Z') // a Thursday, 10:00 Europe/London (BST)

describe('buildNextUpRows', () => {
  it('returns an empty array when session/wellbeing/fixture are all empty — the page renders one shared empty-state message, not three', () => {
    const rows = buildNextUpRows({
      todaySessions: [],
      hasOpenWellbeingSurvey: false,
      nextFixture: null,
      now: NOW,
    })
    expect(rows).toEqual([])
  })

  it('includes only the next not-yet-finished session, skipping ones that already ended today', () => {
    const rows = buildNextUpRows({
      todaySessions: [
        { session_label: 'Finished AM session', opens_at: '2026-09-17T07:00:00.000Z', closes_at: '2026-09-17T08:00:00.000Z' },
        { session_label: 'Afternoon training', opens_at: '2026-09-17T13:00:00.000Z', closes_at: '2026-09-17T15:00:00.000Z' },
      ],
      hasOpenWellbeingSurvey: false,
      nextFixture: null,
      now: NOW,
    })
    expect(rows).toEqual([
      { kind: 'session', label: 'Afternoon training', timeLabel: '14:00', live: false },
    ])
  })

  it('marks a session live when "now" falls inside its open/close window', () => {
    const rows = buildNextUpRows({
      todaySessions: [
        { session_label: 'AM check-in', opens_at: '2026-09-17T08:00:00.000Z', closes_at: '2026-09-17T10:00:00.000Z' },
      ],
      hasOpenWellbeingSurvey: false,
      nextFixture: null,
      now: NOW,
    })
    expect(rows).toEqual([
      { kind: 'session', label: 'AM check-in', timeLabel: '09:00', live: true },
    ])
  })

  it('includes a wellbeing row when a survey is open', () => {
    const rows = buildNextUpRows({
      todaySessions: [],
      hasOpenWellbeingSurvey: true,
      nextFixture: null,
      now: NOW,
    })
    expect(rows).toEqual([{ kind: 'wellbeing' }])
  })

  it('includes the next fixture when it is within 7 days', () => {
    const rows = buildNextUpRows({
      todaySessions: [],
      hasOpenWellbeingSurvey: false,
      nextFixture: { opponent: 'Chester City', match_date: '2026-09-20', location: 'Home' },
      now: NOW,
    })
    expect(rows).toEqual([
      { kind: 'fixture', opponent: 'Chester City', daysLabel: '3d', location: 'Home' },
    ])
  })

  it('excludes a fixture more than 7 days away', () => {
    const rows = buildNextUpRows({
      todaySessions: [],
      hasOpenWellbeingSurvey: false,
      nextFixture: { opponent: 'Wrexham', match_date: '2026-10-05', location: null },
      now: NOW,
    })
    expect(rows).toEqual([])
  })

  it('returns all three rows, in order, when every category has content', () => {
    const rows = buildNextUpRows({
      todaySessions: [
        { session_label: 'Afternoon training', opens_at: '2026-09-17T13:00:00.000Z', closes_at: '2026-09-17T15:00:00.000Z' },
      ],
      hasOpenWellbeingSurvey: true,
      nextFixture: { opponent: 'Chester City', match_date: '2026-09-20', location: 'Home' },
      now: NOW,
    })
    expect(rows.map(r => r.kind)).toEqual(['session', 'wellbeing', 'fixture'])
  })
})
