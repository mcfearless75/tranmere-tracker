import {
  phaseState,
  buildStudentDayStatus,
  missingStudents,
  dayDots,
  isExpectedToday,
  describeCardState,
  defaultStaffFilter,
  applyStaffFilter,
  type StudentDayStatus,
  type PhaseRecord,
} from '@/lib/attendance/dayStatus'
import type { PhaseWindows } from '@/lib/attendance/phase'

const WINDOWS: PhaseWindows = {
  am: { start: '07:30', end: '10:30' },
  lunch: { start: '11:00', end: '14:30' },
  pm: { start: '14:30', end: '17:30' },
}

// A fixed instant during the lunch window (13:00 London, which is 12:00 UTC in BST).
const DURING_LUNCH = new Date('2026-09-16T12:00:00Z')
// Before the AM window has opened (06:00 London / 05:00 UTC in BST).
const BEFORE_AM = new Date('2026-09-16T05:00:00Z')

describe('phaseState', () => {
  it('is "checked" for an unflagged tap, regardless of window or excusal', () => {
    const record: PhaseRecord = { checkedAt: '2026-09-16T08:00:00Z', isFlagged: false, flagReason: null }
    expect(phaseState(record, WINDOWS.am, DURING_LUNCH, true)).toBe('checked')
  })

  it('is "flagged" for a flagged tap — still counts as present, not missing', () => {
    const record: PhaseRecord = { checkedAt: '2026-09-16T08:00:00Z', isFlagged: true, flagReason: 'GPS 900m from academy' }
    expect(phaseState(record, WINDOWS.am, DURING_LUNCH, false)).toBe('flagged')
  })

  it('is "excused" when there is no tap and the phase is excused', () => {
    expect(phaseState(undefined, WINDOWS.lunch, DURING_LUNCH, true)).toBe('excused')
  })

  it('a real tap wins over a stale excusal', () => {
    const record: PhaseRecord = { checkedAt: '2026-09-16T08:00:00Z', isFlagged: false, flagReason: null }
    expect(phaseState(record, WINDOWS.am, DURING_LUNCH, true)).toBe('checked')
  })

  it('is "not_yet" before the window has opened, no tap, not excused', () => {
    expect(phaseState(undefined, WINDOWS.am, BEFORE_AM, false)).toBe('not_yet')
  })

  it('is "missing" once the window is open, no tap, not excused', () => {
    expect(phaseState(undefined, WINDOWS.lunch, DURING_LUNCH, false)).toBe('missing')
  })

  it('is "missing" after the window has closed, no tap, not excused', () => {
    expect(phaseState(undefined, WINDOWS.am, DURING_LUNCH, false)).toBe('missing')
  })
})

describe('buildStudentDayStatus', () => {
  it('assembles all three phases from raw records', () => {
    const status = buildStudentDayStatus(
      'student-1',
      { am: { checkedAt: '2026-09-16T08:00:00Z', isFlagged: false, flagReason: null } },
      WINDOWS,
      DURING_LUNCH,
      [],
    )
    expect(status.phases.am.state).toBe('checked')
    expect(status.phases.am.at).toBe('2026-09-16T08:00:00Z')
    expect(status.phases.lunch.state).toBe('missing')
    expect(status.phases.pm.state).toBe('not_yet')
  })

  it('carries the flag reason only when the phase is actually flagged', () => {
    const status = buildStudentDayStatus(
      'student-1',
      { am: { checkedAt: '2026-09-16T08:00:00Z', isFlagged: true, flagReason: 'No GPS provided' } },
      WINDOWS,
      DURING_LUNCH,
      [],
    )
    expect(status.phases.am.flag).toBe('No GPS provided')
    expect(status.phases.lunch.flag).toBeNull()
  })
})

describe('missingStudents', () => {
  function fixture(phaseStates: Partial<Record<'am' | 'lunch' | 'pm', StudentDayStatus['phases']['am']['state']>>): StudentDayStatus {
    const base: StudentDayStatus['phases'] = {
      am: { state: 'checked', at: null, flag: null },
      lunch: { state: 'checked', at: null, flag: null },
      pm: { state: 'checked', at: null, flag: null },
    }
    for (const [phase, state] of Object.entries(phaseStates)) {
      base[phase as 'am' | 'lunch' | 'pm'] = { state: state!, at: null, flag: null }
    }
    return { studentId: 'x', phases: base }
  }

  it('excludes excused students from the missing list', () => {
    const roster = [fixture({ lunch: 'excused' })]
    expect(missingStudents(roster, 'lunch')).toHaveLength(0)
  })

  it('excludes not_yet students from the missing list', () => {
    const roster = [fixture({ pm: 'not_yet' })]
    expect(missingStudents(roster, 'pm')).toHaveLength(0)
  })

  it('excludes late students from the missing list (late is not missing)', () => {
    const roster = [fixture({ am: 'late' })]
    expect(missingStudents(roster, 'am')).toHaveLength(0)
  })

  it('lists flagged students separately from missing — they are present, just flagged', () => {
    const roster = [fixture({ lunch: 'flagged' })]
    expect(missingStudents(roster, 'lunch')).toHaveLength(0)
  })

  it('includes a genuinely missing student', () => {
    const roster = [fixture({ pm: 'missing' })]
    expect(missingStudents(roster, 'pm')).toHaveLength(1)
  })
})

describe('dayDots', () => {
  it('marks checked, late, excused and flagged as filled', () => {
    const status: StudentDayStatus = {
      studentId: 'x',
      phases: {
        am: { state: 'checked', at: null, flag: null },
        lunch: { state: 'flagged', at: null, flag: 'GPS' },
        pm: { state: 'excused', at: null, flag: null },
      },
    }
    expect(dayDots(status)).toEqual(['am', 'lunch', 'pm'])
  })

  it('leaves missing and not_yet unfilled', () => {
    const status: StudentDayStatus = {
      studentId: 'x',
      phases: {
        am: { state: 'checked', at: null, flag: null },
        lunch: { state: 'missing', at: null, flag: null },
        pm: { state: 'not_yet', at: null, flag: null },
      },
    }
    expect(dayDots(status)).toEqual(['am'])
  })
})

describe('describeCardState', () => {
  it('is "weekend" on a non-weekday, even with an open phase', () => {
    const saturday = new Date('2026-09-19T12:00:00Z')
    const status = buildStudentDayStatus('s', {}, WINDOWS, saturday, [])
    expect(describeCardState(status, WINDOWS, saturday)).toEqual({ kind: 'weekend' })
  })

  it('is "cta" for the currently open, missing phase', () => {
    const status = buildStudentDayStatus('s', {}, WINDOWS, DURING_LUNCH, [])
    expect(describeCardState(status, WINDOWS, DURING_LUNCH)).toEqual({ kind: 'cta', phase: 'lunch' })
  })

  it('is "upcoming" the next window when nothing is open (a gap, or before the day starts)', () => {
    const status = buildStudentDayStatus('s', {}, WINDOWS, BEFORE_AM, [])
    expect(describeCardState(status, WINDOWS, BEFORE_AM)).toEqual({ kind: 'upcoming', phase: 'am', startsAt: '07:30' })
  })

  it('is "upcoming" the next phase once the open one is already handled', () => {
    const status = buildStudentDayStatus(
      's',
      { lunch: { checkedAt: '2026-09-16T11:30:00Z', isFlagged: false, flagReason: null } },
      WINDOWS,
      DURING_LUNCH,
      [],
    )
    expect(describeCardState(status, WINDOWS, DURING_LUNCH)).toEqual({ kind: 'upcoming', phase: 'pm', startsAt: '14:30' })
  })

  it('is "done" once every phase is checked or excused', () => {
    const status = buildStudentDayStatus(
      's',
      {
        am: { checkedAt: '2026-09-16T08:00:00Z', isFlagged: false, flagReason: null },
        lunch: { checkedAt: '2026-09-16T12:00:00Z', isFlagged: false, flagReason: null },
      },
      WINDOWS,
      DURING_LUNCH,
      ['pm'],
    )
    expect(describeCardState(status, WINDOWS, DURING_LUNCH)).toEqual({ kind: 'done' })
  })

  it('is "closed" once the day is over and something is still missing', () => {
    const afterPm = new Date('2026-09-16T17:00:00Z') // 18:00 London, past pm.end (17:30)
    const status = buildStudentDayStatus('s', {}, WINDOWS, afterPm, [])
    expect(describeCardState(status, WINDOWS, afterPm)).toEqual({ kind: 'closed' })
  })
})

describe('defaultStaffFilter', () => {
  it('defaults to missing_am before the lunch window opens', () => {
    expect(defaultStaffFilter(WINDOWS, BEFORE_AM)).toBe('missing_am')
  })

  it('defaults to missing_lunch once the lunch window has opened', () => {
    expect(defaultStaffFilter(WINDOWS, DURING_LUNCH)).toBe('missing_lunch')
  })

  it('defaults to missing_pm once the pm window has opened', () => {
    const afterPmOpen = new Date('2026-09-16T14:00:00Z') // 15:00 London, past pm.start (14:30)
    expect(defaultStaffFilter(WINDOWS, afterPmOpen)).toBe('missing_pm')
  })
})

describe('applyStaffFilter', () => {
  function fixture(id: string, phaseStates: Record<'am' | 'lunch' | 'pm', StudentDayStatus['phases']['am']['state']>): StudentDayStatus {
    return {
      studentId: id,
      phases: {
        am: { state: phaseStates.am, at: null, flag: null },
        lunch: { state: phaseStates.lunch, at: null, flag: null },
        pm: { state: phaseStates.pm, at: null, flag: null },
      },
    }
  }

  const roster = [
    fixture('missing-lunch-kid', { am: 'checked', lunch: 'missing', pm: 'not_yet' }),
    fixture('flagged-kid', { am: 'flagged', lunch: 'not_yet', pm: 'not_yet' }),
    fixture('all-good-kid', { am: 'checked', lunch: 'checked', pm: 'checked' }),
  ]

  it('"all" returns the whole roster unfiltered', () => {
    expect(applyStaffFilter(roster, 'all')).toHaveLength(3)
  })

  it('"missing_lunch" returns only the student missing lunch', () => {
    const result = applyStaffFilter(roster, 'missing_lunch')
    expect(result.map(s => s.studentId)).toEqual(['missing-lunch-kid'])
  })

  it('"flagged" returns only the flagged student', () => {
    const result = applyStaffFilter(roster, 'flagged')
    expect(result.map(s => s.studentId)).toEqual(['flagged-kid'])
  })
})

describe('isExpectedToday', () => {
  it('is true on a weekday', () => {
    expect(isExpectedToday(new Date('2026-09-16T12:00:00Z'))).toBe(true) // Wednesday
  })

  it('is false on a weekend', () => {
    expect(isExpectedToday(new Date('2026-09-19T12:00:00Z'))).toBe(false) // Saturday
    expect(isExpectedToday(new Date('2026-09-20T12:00:00Z'))).toBe(false) // Sunday
  })
})
