import {
  getPersonalBests,
  formatLift,
  COMMON_EXERCISES,
  type GymLog,
} from '@/lib/gym/gymUtils'

describe('COMMON_EXERCISES', () => {
  it('is a non-empty array of strings', () => {
    expect(Array.isArray(COMMON_EXERCISES)).toBe(true)
    expect(COMMON_EXERCISES.length).toBeGreaterThanOrEqual(10)
    COMMON_EXERCISES.forEach(e => expect(typeof e).toBe('string'))
  })
})

describe('getPersonalBests', () => {
  it('returns empty object for empty log array', () => {
    expect(getPersonalBests([])).toEqual({})
  })

  it('returns max weight per exercise', () => {
    const logs: GymLog[] = [
      { exercise: 'Squat', weight_kg: 80, sets: 3, reps: 5, logged_date: '2024-01-01' },
      { exercise: 'Squat', weight_kg: 100, sets: 3, reps: 3, logged_date: '2024-01-08' },
      { exercise: 'Squat', weight_kg: 90, sets: 3, reps: 4, logged_date: '2024-01-05' },
    ]
    expect(getPersonalBests(logs)).toEqual({ Squat: 100 })
  })

  it('handles multiple exercises independently', () => {
    const logs: GymLog[] = [
      { exercise: 'Squat',     weight_kg: 100, sets: 3, reps: 5, logged_date: '2024-01-01' },
      { exercise: 'Bench Press', weight_kg: 80, sets: 3, reps: 8, logged_date: '2024-01-01' },
      { exercise: 'Deadlift',  weight_kg: 140, sets: 1, reps: 5, logged_date: '2024-01-01' },
    ]
    const pbs = getPersonalBests(logs)
    expect(pbs['Squat']).toBe(100)
    expect(pbs['Bench Press']).toBe(80)
    expect(pbs['Deadlift']).toBe(140)
  })

  it('skips logs where weight_kg is null', () => {
    const logs: GymLog[] = [
      { exercise: 'Pull-ups', weight_kg: null, sets: 3, reps: 10, logged_date: '2024-01-01' },
    ]
    expect(getPersonalBests(logs)).toEqual({})
  })

  it('skips null weight but picks up non-null weight for same exercise', () => {
    const logs: GymLog[] = [
      { exercise: 'Pull-ups', weight_kg: null, sets: 3, reps: 10, logged_date: '2024-01-01' },
      { exercise: 'Pull-ups', weight_kg: 10, sets: 3, reps: 8, logged_date: '2024-01-08' },
    ]
    expect(getPersonalBests(logs)).toEqual({ 'Pull-ups': 10 })
  })

  it('handles a single log entry', () => {
    const logs: GymLog[] = [
      { exercise: 'Overhead Press', weight_kg: 60, sets: 4, reps: 6, logged_date: '2024-01-01' },
    ]
    expect(getPersonalBests(logs)).toEqual({ 'Overhead Press': 60 })
  })
})

describe('formatLift', () => {
  it('formats a full log entry with sets, reps and weight', () => {
    const log: GymLog = { exercise: 'Squat', weight_kg: 80, sets: 3, reps: 8, logged_date: '2024-01-01' }
    expect(formatLift(log)).toBe('3 sets × 8 reps @ 80kg')
  })

  it('formats with no weight (bodyweight exercise)', () => {
    const log: GymLog = { exercise: 'Pull-ups', weight_kg: null, sets: 4, reps: 10, logged_date: '2024-01-01' }
    expect(formatLift(log)).toBe('4 sets × 10 reps')
  })

  it('formats with no sets', () => {
    const log: GymLog = { exercise: 'Run', weight_kg: null, sets: null, reps: null, logged_date: '2024-01-01' }
    expect(formatLift(log)).toBe('')
  })

  it('formats with sets but no reps', () => {
    const log: GymLog = { exercise: 'Plank', weight_kg: null, sets: 3, reps: null, logged_date: '2024-01-01' }
    expect(formatLift(log)).toBe('3 sets')
  })

  it('handles decimal weight correctly', () => {
    const log: GymLog = { exercise: 'Curl', weight_kg: 12.5, sets: 3, reps: 12, logged_date: '2024-01-01' }
    expect(formatLift(log)).toBe('3 sets × 12 reps @ 12.5kg')
  })
})
