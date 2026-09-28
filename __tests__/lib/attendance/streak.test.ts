import { computeStreak, isSelfScan, openDaysFromCohort, type StreakDay } from '@/lib/attendance/streak'

const T = '2026-09-10T08:00:00Z'

function full(date: string): StreakDay {
  return { attendance_date: date, am_checked_at: T, pm_checked_at: T, am_flag_reason: null, pm_flag_reason: null }
}

// Mon 7 Sep … Fri 18 Sep 2026. Wednesdays are 9th and 16th.
const OPEN = ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-14', '2026-09-15', '2026-09-16']

function run(days: StreakDay[], opts: { today?: string; excused?: string[]; open?: string[] } = {}) {
  return computeStreak({
    days,
    openDates: new Set(opts.open ?? OPEN),
    excusedDates: new Set(opts.excused ?? []),
    today: opts.today ?? '2026-09-16',
  })
}

describe('isSelfScan', () => {
  it('counts a real scan, including GPS-flagged ones', () => {
    expect(isSelfScan(T, null)).toBe(true)
    expect(isSelfScan(T, 'GPS 400m from academy (±1500m accuracy)')).toBe(true)
  })

  it('does not count a staff manual override or a missing scan', () => {
    expect(isSelfScan(T, 'Manual override by Paul')).toBe(false)
    expect(isSelfScan(null, null)).toBe(false)
  })
})

describe('computeStreak', () => {
  it('counts consecutive full self-scanned days', () => {
    const r = run(['2026-09-10', '2026-09-11', '2026-09-14', '2026-09-15'].map(full), { today: '2026-09-15' })
    expect(r.current).toBe(4)
    expect(r.best).toBe(4)
    expect(r.todayDone).toBe(true)
  })

  it('breaks on an open day with no scan-out, but keeps best', () => {
    const days = ['2026-09-07', '2026-09-08', '2026-09-10'].map(full)
    days.push({ ...full('2026-09-11'), pm_checked_at: null })
    days.push(full('2026-09-14'))
    const r = run(days, { today: '2026-09-14' })
    expect(r.current).toBe(1)
    expect(r.best).toBe(3)
  })

  it('a staff manual override breaks the streak', () => {
    const days = [full('2026-09-10'), { ...full('2026-09-11'), pm_flag_reason: 'Manual override by Paul' }, full('2026-09-14')]
    expect(run(days, { today: '2026-09-14' }).current).toBe(1)
  })

  it('an unfinished today does not break the streak', () => {
    const days = [full('2026-09-10'), full('2026-09-11'), { ...full('2026-09-14'), pm_checked_at: null }]
    const r = run(days, { today: '2026-09-14' })
    expect(r.current).toBe(2)
    expect(r.todayDone).toBe(false)
  })

  it('excused days are skipped, not broken', () => {
    const days = [full('2026-09-10'), full('2026-09-14')]
    expect(run(days, { today: '2026-09-14', excused: ['2026-09-11'] }).current).toBe(2)
  })

  it('a missed Wednesday (match day) is skipped, a full Wednesday counts', () => {
    const missedWed = [full('2026-09-08'), full('2026-09-10')]
    expect(run(missedWed, { today: '2026-09-10' }).current).toBe(2)
    const fullWed = [full('2026-09-08'), full('2026-09-09'), full('2026-09-10')]
    expect(run(fullWed, { today: '2026-09-10' }).current).toBe(3)
  })

  it('closed days (weekends, holidays) neither count nor break', () => {
    // 11th not open (e.g. an INSET day) and the student did not scan: skipped
    const days = [full('2026-09-10'), full('2026-09-14')]
    const open = OPEN.filter(d => d !== '2026-09-11')
    expect(run(days, { today: '2026-09-14', open }).current).toBe(2)
  })

  it('ignores rows dated after today', () => {
    expect(run([full('2026-09-14'), full('2026-09-15')], { today: '2026-09-14' }).current).toBe(1)
  })

  it('is zero with no data', () => {
    expect(run([])).toEqual({ current: 0, best: 0, todayDone: false })
  })
})

describe('openDaysFromCohort', () => {
  it('marks a day open only when enough students self-scanned in', () => {
    const rows = [
      ...Array.from({ length: 10 }, () => ({ attendance_date: '2026-09-14', am_flag_reason: null })),
      ...Array.from({ length: 9 }, () => ({ attendance_date: '2026-09-15', am_flag_reason: null })),
      // Staff bulk-marked a Sunday — must not make it an open day
      ...Array.from({ length: 40 }, () => ({ attendance_date: '2026-09-20', am_flag_reason: 'Manual override by Paul' })),
    ]
    expect([...openDaysFromCohort(rows)]).toEqual(['2026-09-14'])
  })
})
