import {
  lastNLondonWeekdays,
  classifyFlagReason,
  isManualOverride,
  computeCheckInHealth,
  type HealthAttendanceRecord,
  type HealthStudent,
} from '@/lib/attendance/healthStats'
import type { PhaseWindows } from '@/lib/attendance/phase'

const WINDOWS: PhaseWindows = {
  am: { start: '07:30', end: '10:30' },
  lunch: { start: '11:00', end: '14:30' },
  pm: { start: '14:30', end: '17:30' },
}

// 18:00 London (BST) — after every window has closed for the day.
const AFTER_PM_16TH = new Date('2026-09-16T17:00:00Z')

function rec(overrides: Partial<HealthAttendanceRecord> & { student_id: string; attendance_date: string }): HealthAttendanceRecord {
  return {
    am_checked_at: null, lunch_checked_at: null, pm_checked_at: null,
    am_is_flagged: false, lunch_is_flagged: false, pm_is_flagged: false,
    am_flag_reason: null, lunch_flag_reason: null, pm_flag_reason: null,
    ...overrides,
  }
}

describe('lastNLondonWeekdays', () => {
  it('returns just today when n=1 and today is a weekday', () => {
    expect(lastNLondonWeekdays(1, '2026-09-16')).toEqual(['2026-09-16']) // Wednesday
  })

  it('walks backwards skipping Sat/Sun, oldest first', () => {
    // 2026-09-16 is a Wednesday. The 7 preceding weekdays (inclusive) skip
    // the weekend of the 12th/13th.
    expect(lastNLondonWeekdays(7, '2026-09-16')).toEqual([
      '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11',
      '2026-09-14', '2026-09-15', '2026-09-16',
    ])
  })

  it('starts from the prior Friday when today itself is a weekend', () => {
    // 2026-09-19 is a Saturday — the sweep starts counting from the Friday before it.
    expect(lastNLondonWeekdays(1, '2026-09-19')).toEqual(['2026-09-18'])
  })
})

describe('isManualOverride', () => {
  it('is true for a "Manual override by <staff>" reason', () => {
    expect(isManualOverride('Manual override by Paul McCarthy')).toBe(true)
  })

  it('is false for a real flag reason, null, or undefined', () => {
    expect(isManualOverride('No GPS provided')).toBe(false)
    expect(isManualOverride(null)).toBe(false)
    expect(isManualOverride(undefined)).toBe(false)
  })
})

describe('classifyFlagReason', () => {
  it('classifies the exact "No GPS provided" RPC reason', () => {
    expect(classifyFlagReason('No GPS provided')).toBe('no_gps')
  })

  it('classifies the permission-denied relabel used by both check-in routes', () => {
    expect(classifyFlagReason('Location permission denied on device — check-in allowed without GPS proof')).toBe('permission_denied')
  })

  it('classifies tap-checkin\'s coarse-fix tolerance bypass before the generic outside-fence match', () => {
    expect(classifyFlagReason('GPS 340m from academy (±400m accuracy) — coarse fix, in-app tap')).toBe('coarse_fix')
  })

  it('classifies the RPC\'s plain outside-fence reasons, with or without an accuracy suffix', () => {
    expect(classifyFlagReason('GPS 900m from academy (±50m accuracy)')).toBe('outside_fence')
    expect(classifyFlagReason('GPS 900m from academy')).toBe('outside_fence')
  })

  it('excludes a manual-override reason (staff-caused, not a check-in-health signal)', () => {
    expect(classifyFlagReason('Manual override by Paul McCarthy')).toBeNull()
  })

  it('returns null for no reason', () => {
    expect(classifyFlagReason(null)).toBeNull()
    expect(classifyFlagReason(undefined)).toBeNull()
  })

  it('falls back to "other" for an unrecognised reason', () => {
    expect(classifyFlagReason('Something new nobody has seen yet')).toBe('other')
  })
})

describe('computeCheckInHealth', () => {
  const students: HealthStudent[] = [
    { id: 's1', name: 'Amy' },
    { id: 's2', name: 'Ben' },
  ]

  it('aggregates phase completion, missing rate, flagged rate and flag breakdown over a 1-day window', () => {
    // Amy: AM tapped but denied GPS permission; lunch + pm tapped clean.
    // Ben: AM tapped clean; lunch missing (window closed, not excused); pm tapped clean.
    const records: HealthAttendanceRecord[] = [
      rec({
        student_id: 's1', attendance_date: '2026-09-16',
        am_checked_at: '2026-09-16T08:00:00Z', am_is_flagged: true,
        am_flag_reason: 'Location permission denied on device — check-in allowed without GPS proof',
        lunch_checked_at: '2026-09-16T12:00:00Z',
        pm_checked_at: '2026-09-16T16:00:00Z',
      }),
      rec({
        student_id: 's2', attendance_date: '2026-09-16',
        am_checked_at: '2026-09-16T08:00:00Z',
        pm_checked_at: '2026-09-16T16:00:00Z',
      }),
    ]

    const stats = computeCheckInHealth(students, records, WINDOWS, 1, '2026-09-16', AFTER_PM_16TH)

    expect(stats.dateRange).toEqual(['2026-09-16'])

    // AM: both tapped -> 2/2 = 100%.
    expect(stats.phaseCompletion.am).toEqual({ tapped: 2, expected: 2, pct: 100 })
    // Lunch: only Amy tapped -> 1/2 = 50%.
    expect(stats.phaseCompletion.lunch).toEqual({ tapped: 1, expected: 2, pct: 50 })
    // PM: both tapped -> 2/2 = 100%.
    expect(stats.phaseCompletion.pm).toEqual({ tapped: 2, expected: 2, pct: 100 })

    // Missing lunch: Ben -> 1/2 = 50%. Missing PM: nobody -> 0/2 = 0%.
    expect(stats.missingRate.lunch).toEqual({ tapped: 1, expected: 2, pct: 50 })
    expect(stats.missingRate.pm).toEqual({ tapped: 0, expected: 2, pct: 0 })

    // 1 flagged (non-override) tap out of 5 total taps (2 am + 1 lunch + 2 pm).
    expect(stats.flaggedRate).toEqual({ flaggedCount: 1, totalTaps: 5, pct: 20 })
    expect(stats.flagBreakdown).toEqual({
      no_gps: 0, permission_denied: 1, coarse_fix: 0, outside_fence: 0, other: 0,
    })

    // Only 1 day of permission-denied so far in this window — not yet "repeat".
    expect(stats.repeatLocationDenied).toEqual([])
  })

  it('excludes a manual-override flag from the flagged rate and breakdown, but still counts it as tapped', () => {
    const records: HealthAttendanceRecord[] = [
      rec({
        student_id: 's1', attendance_date: '2026-09-16',
        am_checked_at: '2026-09-16T09:00:00Z', am_is_flagged: true,
        am_flag_reason: 'Manual override by Paul McCarthy',
      }),
    ]
    const stats = computeCheckInHealth([students[0]], records, WINDOWS, 1, '2026-09-16', AFTER_PM_16TH)

    expect(stats.phaseCompletion.am).toEqual({ tapped: 1, expected: 1, pct: 100 })
    expect(stats.flaggedRate.flaggedCount).toBe(0)
    expect(stats.flagBreakdown.other).toBe(0)
  })

  it('never counts an excused phase as expected, and never counts a not-yet-open phase as missing', () => {
    // Before the AM window opens on the 16th (06:00 London): nothing is due yet.
    const beforeAm = new Date('2026-09-16T05:00:00Z')
    const records: HealthAttendanceRecord[] = []
    const excusals = new Map([[`s1|2026-09-16`, ['am' as const]]])
    const stats = computeCheckInHealth(students, records, WINDOWS, 1, '2026-09-16', beforeAm, excusals)

    // Amy excused for AM (not expected); Ben not excused but the window
    // hasn't opened yet (not_yet, also not expected) -> denominator 0.
    expect(stats.phaseCompletion.am).toEqual({ tapped: 0, expected: 0, pct: null })
  })

  it('flags a student with permission-denied on 2+ distinct days in the window as a repeat', () => {
    const records: HealthAttendanceRecord[] = [
      rec({
        student_id: 's1', attendance_date: '2026-09-15',
        am_checked_at: '2026-09-15T08:00:00Z', am_is_flagged: true,
        am_flag_reason: 'Location permission denied on device — check-in allowed without GPS proof',
      }),
      rec({
        student_id: 's1', attendance_date: '2026-09-16',
        am_checked_at: '2026-09-16T08:00:00Z', am_is_flagged: true,
        am_flag_reason: 'Location permission denied on device — check-in allowed without GPS proof',
      }),
    ]
    const stats = computeCheckInHealth([students[0]], records, WINDOWS, 2, '2026-09-16', AFTER_PM_16TH)

    expect(stats.dateRange).toEqual(['2026-09-15', '2026-09-16'])
    expect(stats.repeatLocationDenied).toEqual([{ studentId: 's1', name: 'Amy', days: 2 }])
  })

  it('handles an empty academy (no students, no records) without crashing', () => {
    const stats = computeCheckInHealth([], [], WINDOWS, 7, '2026-09-16', AFTER_PM_16TH)
    expect(stats.phaseCompletion.am).toEqual({ tapped: 0, expected: 0, pct: null })
    expect(stats.flaggedRate).toEqual({ flaggedCount: 0, totalTaps: 0, pct: null })
    expect(stats.repeatLocationDenied).toEqual([])
  })
})
