import { buildAttendanceWeeks } from '@/lib/charts/attendanceUtils'

describe('buildAttendanceWeeks', () => {
  it('returns empty array when both inputs are empty', () => {
    expect(buildAttendanceWeeks([], [])).toEqual([])
  })

  it('returns empty array when only attended days given (no scheduled)', () => {
    expect(buildAttendanceWeeks([{ attendance_date: '2024-01-08' }], [])).toEqual([])
  })

  it('groups scheduled days into correct ISO weeks', () => {
    const scheduled = [
      { scheduled_date: '2024-01-08' }, // Mon week 1
      { scheduled_date: '2024-01-09' }, // Tue week 1
      { scheduled_date: '2024-01-15' }, // Mon week 2
    ]
    const result = buildAttendanceWeeks([], scheduled)
    expect(result).toHaveLength(2)
    expect(result[0].scheduled).toBe(2)
    expect(result[1].scheduled).toBe(1)
  })

  it('counts attended days correctly within each week', () => {
    const scheduled = [
      { scheduled_date: '2024-01-08' },
      { scheduled_date: '2024-01-09' },
      { scheduled_date: '2024-01-10' },
    ]
    const attended = [
      { attendance_date: '2024-01-08' },
      { attendance_date: '2024-01-09' },
    ]
    const result = buildAttendanceWeeks(attended, scheduled)
    expect(result).toHaveLength(1)
    expect(result[0].attended).toBe(2)
    expect(result[0].scheduled).toBe(3)
  })

  it('calculates pct as Math.round(attended / scheduled * 100)', () => {
    const scheduled = [
      { scheduled_date: '2024-01-08' },
      { scheduled_date: '2024-01-09' },
      { scheduled_date: '2024-01-10' },
    ]
    const attended = [{ attendance_date: '2024-01-08' }]
    const result = buildAttendanceWeeks(attended, scheduled)
    expect(result[0].pct).toBe(33)
  })

  it('returns pct 0 when attended is 0', () => {
    const scheduled = [{ scheduled_date: '2024-01-08' }]
    const result = buildAttendanceWeeks([], scheduled)
    expect(result[0].pct).toBe(0)
    expect(result[0].attended).toBe(0)
  })

  it('returns pct 100 when all scheduled days attended', () => {
    const scheduled = [{ scheduled_date: '2024-01-08' }, { scheduled_date: '2024-01-09' }]
    const attended = [{ attendance_date: '2024-01-08' }, { attendance_date: '2024-01-09' }]
    const result = buildAttendanceWeeks(attended, scheduled)
    expect(result[0].pct).toBe(100)
  })

  it('sorts weeks chronologically (oldest first)', () => {
    const scheduled = [
      { scheduled_date: '2024-01-22' }, // week 3
      { scheduled_date: '2024-01-08' }, // week 1
      { scheduled_date: '2024-01-15' }, // week 2
    ]
    const result = buildAttendanceWeeks([], scheduled)
    expect(result[0].week).toBe('08 Jan')
    expect(result[1].week).toBe('15 Jan')
    expect(result[2].week).toBe('22 Jan')
  })

  it('week label is formatted as "DD Mon" of the Monday', () => {
    const scheduled = [{ scheduled_date: '2024-03-13' }] // Wed — Monday is 11 Mar
    const result = buildAttendanceWeeks([], scheduled)
    expect(result[0].week).toBe('11 Mar')
  })

  it('only counts attendance on scheduled dates (not arbitrary days)', () => {
    const scheduled = [{ scheduled_date: '2024-01-08' }]
    const attended = [
      { attendance_date: '2024-01-08' }, // scheduled — should count
      { attendance_date: '2024-01-09' }, // not scheduled — should NOT count
    ]
    const result = buildAttendanceWeeks(attended, scheduled)
    expect(result[0].attended).toBe(1)
  })

  it('spans multiple weeks with correct per-week counts', () => {
    const scheduled = [
      { scheduled_date: '2024-01-08' },
      { scheduled_date: '2024-01-09' },
      { scheduled_date: '2024-01-15' },
      { scheduled_date: '2024-01-16' },
    ]
    const attended = [
      { attendance_date: '2024-01-08' },
      { attendance_date: '2024-01-16' },
    ]
    const result = buildAttendanceWeeks(attended, scheduled)
    expect(result).toHaveLength(2)
    expect(result[0].attended).toBe(1)
    expect(result[0].pct).toBe(50)
    expect(result[1].attended).toBe(1)
    expect(result[1].pct).toBe(50)
  })
})
