import {
  DAILY_GOAL_ML,
  totalIntake,
  progressPct,
  intakeLabel,
} from '@/lib/hydration/hydrationUtils'

describe('totalIntake', () => {
  it('returns 0 for empty log array', () => {
    expect(totalIntake([])).toBe(0)
  })

  it('sums all amount_ml values', () => {
    expect(totalIntake([{ amount_ml: 250 }, { amount_ml: 500 }, { amount_ml: 330 }])).toBe(1080)
  })

  it('handles single entry', () => {
    expect(totalIntake([{ amount_ml: 750 }])).toBe(750)
  })
})

describe('progressPct', () => {
  it('returns 0 for zero intake', () => {
    expect(progressPct(0)).toBe(0)
  })

  it('returns 50 for half the daily goal', () => {
    expect(progressPct(DAILY_GOAL_ML / 2)).toBe(50)
  })

  it('returns 100 for exactly the goal', () => {
    expect(progressPct(DAILY_GOAL_ML)).toBe(100)
  })

  it('caps at 100 when intake exceeds goal', () => {
    expect(progressPct(DAILY_GOAL_ML + 1000)).toBe(100)
  })

  it('uses custom goalMl when provided', () => {
    expect(progressPct(1000, 2000)).toBe(50)
  })

  it('returns 0 when goalMl is 0 (guard against division by zero)', () => {
    expect(progressPct(500, 0)).toBe(0)
  })
})

describe('intakeLabel', () => {
  it('formats 0ml correctly', () => {
    expect(intakeLabel(0)).toBe('0.0L of 2.5L')
  })

  it('formats 1200ml correctly', () => {
    expect(intakeLabel(1200)).toBe('1.2L of 2.5L')
  })

  it('formats exactly the goal', () => {
    expect(intakeLabel(2500)).toBe('2.5L of 2.5L')
  })

  it('uses custom goalMl when provided', () => {
    expect(intakeLabel(1000, 2000)).toBe('1.0L of 2.0L')
  })
})
