import { mondayOf, weekDatesFrom, computeWeeklyAttendance, type AttendanceRecord, type Student } from '@/lib/attendance/weeklyReport'

function rec(overrides: Partial<AttendanceRecord> & { student_id: string; attendance_date: string }): AttendanceRecord {
  return {
    am_checked_at: null, lunch_checked_at: null, pm_checked_at: null,
    am_is_flagged: false, lunch_is_flagged: false, pm_is_flagged: false,
    am_flag_reason: null, lunch_flag_reason: null, pm_flag_reason: null,
    ...overrides,
  }
}

describe('mondayOf', () => {
  it('returns the same date when already a Monday', () => {
    expect(mondayOf('2026-09-07')).toBe('2026-09-07') // a Monday
  })

  it('rolls a mid-week date back to that week\'s Monday', () => {
    expect(mondayOf('2026-09-09')).toBe('2026-09-07') // Wednesday -> Monday
    expect(mondayOf('2026-09-11')).toBe('2026-09-07') // Friday -> Monday
  })

  it('rolls Sunday back to the Monday that started that week, not forward', () => {
    expect(mondayOf('2026-09-13')).toBe('2026-09-07') // Sunday belongs to the prior Monday's week
  })
})

describe('weekDatesFrom', () => {
  it('returns Mon-Fri for the week containing the anchor date', () => {
    expect(weekDatesFrom('2026-09-09')).toEqual([
      '2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11',
    ])
  })
})

describe('computeWeeklyAttendance', () => {
  const students: Student[] = [
    { id: 's1', name: 'Alice' },
    { id: 's2', name: 'Bob' },
  ]
  const weekDates = ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11']
  const today = '2026-09-11' // the whole week has "happened"

  it('gives a student with a full 3/3 every day a 100% week', () => {
    const records = weekDates.map(d => rec({
      student_id: 's1', attendance_date: d,
      am_checked_at: '2026-01-01T09:00:00Z', lunch_checked_at: '2026-01-01T12:00:00Z', pm_checked_at: '2026-01-01T15:00:00Z',
    }))
    const { rows } = computeWeeklyAttendance(students, records, weekDates, today)
    const alice = rows.find(r => r.id === 's1')!
    expect(alice.weekPct).toBe(100)
    expect(alice.days.every(d => d.checkedCount === 3 && !d.isFuture)).toBe(true)
  })

  it('gives a student with zero attendance rows a 0% week, not null', () => {
    const { rows } = computeWeeklyAttendance(students, [], weekDates, today)
    const bob = rows.find(r => r.id === 's2')!
    expect(bob.weekPct).toBe(0)
    expect(bob.days.every(d => d.checkedCount === 0)).toBe(true)
  })

  it('computes a partial week correctly (2 of 3 phases on 3 of 5 days = 40%)', () => {
    const records = ['2026-09-07', '2026-09-08', '2026-09-09'].map(d => rec({
      student_id: 's1', attendance_date: d,
      am_checked_at: '2026-01-01T09:00:00Z', lunch_checked_at: '2026-01-01T12:00:00Z', // no pm
    }))
    const { rows } = computeWeeklyAttendance(students, records, weekDates, today)
    const alice = rows.find(r => r.id === 's1')!
    // 3 days * 2 checks = 6 checked; 5 days * 3 possible = 15 possible; 6/15 = 40%
    expect(alice.weekPct).toBe(40)
  })

  it('excludes days after "today" from both the numerator and the denominator', () => {
    const partway = '2026-09-09' // Wednesday — Thu/Fri haven't happened yet
    const records = [
      rec({ student_id: 's1', attendance_date: '2026-09-07', am_checked_at: 'x', lunch_checked_at: 'x', pm_checked_at: 'x' }),
      rec({ student_id: 's1', attendance_date: '2026-09-08', am_checked_at: 'x', lunch_checked_at: 'x', pm_checked_at: 'x' }),
      rec({ student_id: 's1', attendance_date: '2026-09-09', am_checked_at: 'x', lunch_checked_at: 'x', pm_checked_at: 'x' }),
    ]
    const { rows } = computeWeeklyAttendance(students, records, weekDates, partway)
    const alice = rows.find(r => r.id === 's1')!
    expect(alice.weekPct).toBe(100) // 9/9 possible so far
    const [mon, tue, wed, thu, fri] = alice.days
    expect([mon.isFuture, tue.isFuture, wed.isFuture]).toEqual([false, false, false])
    expect([thu.isFuture, fri.isFuture]).toEqual([true, true])
    expect(thu.checkedCount).toBe(0)
  })

  it('collects flagged phases with their reason, student and day', () => {
    const records = [
      rec({ student_id: 's1', attendance_date: '2026-09-07', am_is_flagged: true, am_flag_reason: 'Late by 20 min' }),
    ]
    const { flagNotes } = computeWeeklyAttendance(students, records, weekDates, today)
    expect(flagNotes).toEqual([
      { name: 'Alice', dateISO: '2026-09-07', phase: 'AM', reason: 'Late by 20 min' },
    ])
  })

  it('computes the cohort average across students who have any data so far, and flags below-80% students', () => {
    const records = [
      // Alice: 100%
      ...weekDates.map(d => rec({
        student_id: 's1', attendance_date: d,
        am_checked_at: 'x', lunch_checked_at: 'x', pm_checked_at: 'x',
      })),
      // Bob: 0% (no records at all, i.e. absent every day)
    ]
    const { cohortAvgPct, belowThreshold } = computeWeeklyAttendance(students, records, weekDates, today)
    expect(cohortAvgPct).toBe(50) // (100 + 0) / 2
    expect(belowThreshold.map(r => r.name)).toEqual(['Bob'])
  })

  it('returns null cohort average and no rows when there are no students', () => {
    const { cohortAvgPct, belowThreshold, rows } = computeWeeklyAttendance([], [], weekDates, today)
    expect(cohortAvgPct).toBeNull()
    expect(belowThreshold).toEqual([])
    expect(rows).toEqual([])
  })
})
