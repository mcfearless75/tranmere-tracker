import {
  calcGpsSummary,
  calcAttendanceSummary,
  getPerformanceRating,
  type GpsSummary,
  type AttendanceSummary,
} from '@/lib/performance/performanceUtils'

describe('calcGpsSummary', () => {
  it('returns zeros when given an empty array', () => {
    const result = calcGpsSummary([])
    expect(result).toEqual({ sessions: 0, avgDistanceKm: 0, avgSpeedKmh: 0, maxSpeedKmh: 0 })
  })

  it('counts sessions correctly', () => {
    const sessions = [
      { total_distance_m: 5000 },
      { total_distance_m: 6000 },
      { total_distance_m: 7000 },
    ]
    expect(calcGpsSummary(sessions).sessions).toBe(3)
  })

  it('converts metres to km and averages correctly', () => {
    const sessions = [
      { total_distance_m: 4000 },
      { total_distance_m: 6000 },
    ]
    // avg = 5000m = 5km
    expect(calcGpsSummary(sessions).avgDistanceKm).toBe(5)
  })

  it('rounds avgDistanceKm to 1dp', () => {
    const sessions = [
      { total_distance_m: 3333 },
      { total_distance_m: 3334 },
    ]
    const result = calcGpsSummary(sessions)
    expect(result.avgDistanceKm.toString()).toMatch(/^\d+\.\d$/)
  })

  it('picks max speed from max_speed_kmh across sessions', () => {
    const sessions = [
      { total_distance_m: 5000, max_speed_kmh: 28.5 },
      { total_distance_m: 5000, max_speed_kmh: 31.2 },
    ]
    expect(calcGpsSummary(sessions).maxSpeedKmh).toBe(31.2)
  })

  it('falls back to max_speed_ms * 3.6 when max_speed_kmh is absent', () => {
    const sessions = [{ total_distance_m: 5000, max_speed_ms: 8.0 }]
    // 8 * 3.6 = 28.8
    expect(calcGpsSummary(sessions).maxSpeedKmh).toBe(28.8)
  })

  it('handles null fields without throwing', () => {
    const sessions = [{ total_distance_m: null, max_speed_kmh: null }]
    const result = calcGpsSummary(sessions)
    expect(result.sessions).toBe(1)
    expect(result.avgDistanceKm).toBe(0)
  })

  it('calculates avgSpeedKmh from distance and duration', () => {
    // 6km in 60mins = 6 km/h
    const sessions = [{ total_distance_m: 6000, duration_mins: 60 }]
    expect(calcGpsSummary(sessions).avgSpeedKmh).toBe(6)
  })
})

describe('calcAttendanceSummary', () => {
  it('returns zero pct when totalSessions is 0 and no records', () => {
    const result = calcAttendanceSummary([], 0)
    expect(result.pct).toBe(0)
  })

  it('calculates 100% when all sessions attended', () => {
    const records = [{}, {}, {}]
    const result = calcAttendanceSummary(records, 3)
    expect(result.pct).toBe(100)
    expect(result.attended).toBe(3)
    expect(result.totalSessions).toBe(3)
  })

  it('calculates partial attendance correctly', () => {
    const records = [{}, {}]
    const result = calcAttendanceSummary(records, 4)
    expect(result.pct).toBe(50)
    expect(result.attended).toBe(2)
    expect(result.totalSessions).toBe(4)
  })

  it('rounds pct to 1dp', () => {
    const records = [{}]
    const result = calcAttendanceSummary(records, 3)
    // 1/3 = 33.3...
    expect(result.pct).toBe(33.3)
  })
})

describe('getPerformanceRating', () => {
  const makeGps = (avgDistanceKm: number): GpsSummary => ({
    sessions: 10, avgDistanceKm, avgSpeedKmh: 7, maxSpeedKmh: 28,
  })
  const makeAtt = (pct: number): AttendanceSummary => ({
    totalSessions: 10, attended: Math.round(pct / 10), pct,
  })

  it('returns Excellent when attendance ≥90% and avgDistance ≥5km', () => {
    expect(getPerformanceRating(makeGps(5), makeAtt(90))).toBe('Excellent')
  })

  it('returns Excellent with attendance 100% and distance 8km', () => {
    expect(getPerformanceRating(makeGps(8), makeAtt(100))).toBe('Excellent')
  })

  it('returns Good when attendance ≥75% and avgDistance ≥3km', () => {
    expect(getPerformanceRating(makeGps(4), makeAtt(80))).toBe('Good')
  })

  it('returns Developing when attendance ≥60% but distance <3km', () => {
    expect(getPerformanceRating(makeGps(2), makeAtt(65))).toBe('Developing')
  })

  it('returns Needs Attention when attendance <60%', () => {
    expect(getPerformanceRating(makeGps(6), makeAtt(50))).toBe('Needs Attention')
  })

  it('returns Needs Attention when both low', () => {
    expect(getPerformanceRating(makeGps(1), makeAtt(30))).toBe('Needs Attention')
  })

  it('Good boundary: exactly 75% attendance and 3km distance', () => {
    expect(getPerformanceRating(makeGps(3), makeAtt(75))).toBe('Good')
  })

  it('Excellent boundary: exactly 90% and 5km', () => {
    expect(getPerformanceRating(makeGps(5), makeAtt(90))).toBe('Excellent')
  })
})
