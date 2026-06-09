import {
  aggregateCohort,
  buildCohortReportPrompt,
  COHORT_REPORT_SECTIONS,
  type AttendanceRow,
  type CohortStudent,
  type GpsRow,
  type MatchRow,
  type WellbeingByStudent,
} from '@/lib/cohortReport/cohortReportUtils'

const STUDENTS: CohortStudent[] = [
  { id: 's1', name: 'Alice Adams', year_group: 1 },
  { id: 's2', name: 'Bob Brown', year_group: 1 },
]

function attendanceRow(student_id: string, date: string, present: boolean): AttendanceRow {
  return {
    student_id,
    attendance_date: date,
    am_checked_at: present ? `${date}T08:00:00Z` : null,
    pm_checked_at: null,
  }
}

describe('aggregateCohort — attendance', () => {
  it('computes cohort attendance % from present days over scheduled days × students', () => {
    // 2 students, 10 scheduled days → 20 expected. 15 present → 75%.
    const attendance: AttendanceRow[] = []
    for (let i = 0; i < 10; i++) attendance.push(attendanceRow('s1', `2026-05-${10 + i}`, true))
    for (let i = 0; i < 5; i++) attendance.push(attendanceRow('s2', `2026-05-${10 + i}`, true))

    const { stats } = aggregateCohort({
      students: STUDENTS,
      attendance,
      scheduledDays: 10,
      gps: [],
      matches: [],
      wellbeing: {},
    })

    expect(stats.presentDayCount).toBe(15)
    expect(stats.attendancePct).toBe(75)
  })

  it('returns null attendance % when there are no scheduled days', () => {
    const { stats } = aggregateCohort({
      students: STUDENTS,
      attendance: [],
      scheduledDays: 0,
      gps: [],
      matches: [],
      wellbeing: {},
    })
    expect(stats.attendancePct).toBeNull()
  })

  it('does not count a row with no am/pm check-in as present', () => {
    const { stats } = aggregateCohort({
      students: STUDENTS,
      attendance: [attendanceRow('s1', '2026-05-10', false)],
      scheduledDays: 1,
      gps: [],
      matches: [],
      wellbeing: {},
    })
    expect(stats.presentDayCount).toBe(0)
  })
})

describe('aggregateCohort — GPS', () => {
  it('computes total, average distance (km) and top speed', () => {
    const gps: GpsRow[] = [
      { player_id: 's1', total_distance_m: 6000, max_speed_kmh: 30, sprint_count: 5, session_date: '2026-05-10' },
      { player_id: 's2', total_distance_m: 4000, max_speed_kmh: 32.5, sprint_count: 3, session_date: '2026-05-11' },
    ]
    const { stats } = aggregateCohort({
      students: STUDENTS,
      attendance: [],
      scheduledDays: 0,
      gps,
      matches: [],
      wellbeing: {},
    })
    expect(stats.gpsSessionCount).toBe(2)
    expect(stats.totalGpsDistanceKm).toBe(10)
    expect(stats.avgGpsDistanceKm).toBe(5)
    expect(stats.topSpeedKmh).toBe(32.5)
  })

  it('returns null GPS metrics when there are no sessions', () => {
    const { stats } = aggregateCohort({
      students: STUDENTS,
      attendance: [],
      scheduledDays: 0,
      gps: [],
      matches: [],
      wellbeing: {},
    })
    expect(stats.totalGpsDistanceKm).toBeNull()
    expect(stats.avgGpsDistanceKm).toBeNull()
    expect(stats.topSpeedKmh).toBeNull()
  })
})

describe('aggregateCohort — match', () => {
  it('totals goals/assists and averages coach rating', () => {
    const matches: MatchRow[] = [
      { student_id: 's1', goals: 2, assists: 1, coach_rating: 8, self_rating: 7, match_date: '2026-05-10' },
      { student_id: 's2', goals: 1, assists: 0, coach_rating: 6, self_rating: 6, match_date: '2026-05-12' },
    ]
    const { stats } = aggregateCohort({
      students: STUDENTS,
      attendance: [],
      scheduledDays: 0,
      gps: [],
      matches,
      wellbeing: {},
    })
    expect(stats.totalGoals).toBe(3)
    expect(stats.totalAssists).toBe(1)
    expect(stats.avgCoachRating).toBe(7)
  })
})

describe('aggregateCohort — at-risk detection', () => {
  it('flags a student for low attendance (< 80%)', () => {
    // s1 present 6/10 = 60%; s2 present 9/10 = 90%.
    const attendance: AttendanceRow[] = []
    for (let i = 0; i < 6; i++) attendance.push(attendanceRow('s1', `2026-05-${10 + i}`, true))
    for (let i = 0; i < 9; i++) attendance.push(attendanceRow('s2', `2026-05-${10 + i}`, true))

    const { atRisk } = aggregateCohort({
      students: STUDENTS,
      attendance,
      scheduledDays: 10,
      gps: [],
      matches: [],
      wellbeing: {},
    })
    const ids = atRisk.map(a => a.id)
    expect(ids).toContain('s1')
    expect(ids).not.toContain('s2')
    expect(atRisk.find(a => a.id === 's1')?.reason).toMatch(/attendance/)
  })

  it('flags a student for a wellbeing red flag', () => {
    // mood score 1 (<= 2) is a red flag per wellbeingUtils.
    const wellbeing: WellbeingByStudent = {
      s2: [
        { question_key: 'mood', score: 1 },
        { question_key: 'sleep', score: 4 },
      ],
    }
    const { atRisk, stats } = aggregateCohort({
      students: STUDENTS,
      attendance: [],
      scheduledDays: 0,
      gps: [],
      matches: [],
      wellbeing,
    })
    expect(stats.wellbeingRedFlagCount).toBe(1)
    const flagged = atRisk.find(a => a.id === 's2')
    expect(flagged).toBeDefined()
    expect(flagged?.reason).toMatch(/wellbeing red flag/)
  })

  it('returns no at-risk students when all are healthy', () => {
    const attendance: AttendanceRow[] = []
    for (const s of STUDENTS) {
      for (let i = 0; i < 10; i++) attendance.push(attendanceRow(s.id, `2026-05-${10 + i}`, true))
    }
    const { atRisk } = aggregateCohort({
      students: STUDENTS,
      attendance,
      scheduledDays: 10,
      gps: [],
      matches: [],
      wellbeing: { s1: [{ question_key: 'mood', score: 5 }] },
    })
    expect(atRisk).toHaveLength(0)
  })
})

describe('buildCohortReportPrompt', () => {
  const { stats, atRisk } = aggregateCohort({
    students: STUDENTS,
    attendance: [attendanceRow('s1', '2026-05-10', true)],
    scheduledDays: 1,
    gps: [{ player_id: 's1', total_distance_m: 5000, max_speed_kmh: 30, sprint_count: 4, session_date: '2026-05-10' }],
    matches: [{ student_id: 's1', goals: 1, assists: 1, coach_rating: 7, self_rating: 7, match_date: '2026-05-10' }],
    wellbeing: { s2: [{ question_key: 'stress', score: 1 }] },
  })

  it('includes the cohort label', () => {
    const prompt = buildCohortReportPrompt('Year 1', stats, atRisk)
    expect(prompt).toContain('Year 1')
  })

  it('includes all seven section names', () => {
    const prompt = buildCohortReportPrompt('All students', stats, atRisk)
    for (const section of COHORT_REPORT_SECTIONS) {
      expect(prompt).toContain(section)
    }
    expect(COHORT_REPORT_SECTIONS).toHaveLength(7)
  })

  it('returns a non-empty string', () => {
    const prompt = buildCohortReportPrompt('All students', stats, atRisk)
    expect(typeof prompt).toBe('string')
    expect(prompt.length).toBeGreaterThan(100)
  })
})
