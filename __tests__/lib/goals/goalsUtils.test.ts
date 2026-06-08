import {
  isOverdue,
  daysUntilDeadline,
  sortGoals,
  getCompletionRate,
  PRIORITY_ORDER,
  StudentGoal,
} from '@/lib/goals/goalsUtils'

function makeGoal(overrides: Partial<StudentGoal> = {}): StudentGoal {
  return {
    id: 'goal-1',
    student_id: 'student-1',
    title: 'Test Goal',
    description: null,
    category: 'personal',
    deadline: null,
    priority: 'medium',
    status: 'in_progress',
    completed_at: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

// Helper to get a date string relative to today
function daysFromToday(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

describe('PRIORITY_ORDER', () => {
  it('high has lower number than medium', () => {
    expect(PRIORITY_ORDER.high).toBeLessThan(PRIORITY_ORDER.medium)
  })

  it('medium has lower number than low', () => {
    expect(PRIORITY_ORDER.medium).toBeLessThan(PRIORITY_ORDER.low)
  })
})

describe('isOverdue', () => {
  it('returns false when deadline is in the future and status is in_progress', () => {
    const goal = makeGoal({ deadline: daysFromToday(5) })
    expect(isOverdue(goal)).toBe(false)
  })

  it('returns true when deadline has passed and status is in_progress', () => {
    const goal = makeGoal({ deadline: daysFromToday(-1) })
    expect(isOverdue(goal)).toBe(true)
  })

  it('returns false when deadline has passed but status is completed', () => {
    const goal = makeGoal({ deadline: daysFromToday(-5), status: 'completed' })
    expect(isOverdue(goal)).toBe(false)
  })

  it('returns false when deadline has passed but status is abandoned', () => {
    const goal = makeGoal({ deadline: daysFromToday(-5), status: 'abandoned' })
    expect(isOverdue(goal)).toBe(false)
  })

  it('returns false when no deadline is set', () => {
    const goal = makeGoal({ deadline: null })
    expect(isOverdue(goal)).toBe(false)
  })
})

describe('daysUntilDeadline', () => {
  it('returns null when no deadline is set', () => {
    const goal = makeGoal({ deadline: null })
    expect(daysUntilDeadline(goal)).toBeNull()
  })

  it('returns positive number for a future deadline', () => {
    const goal = makeGoal({ deadline: daysFromToday(7) })
    expect(daysUntilDeadline(goal)).toBe(7)
  })

  it('returns negative number for a past deadline', () => {
    const goal = makeGoal({ deadline: daysFromToday(-3) })
    expect(daysUntilDeadline(goal)).toBe(-3)
  })

  it('returns 0 for today\'s deadline', () => {
    const goal = makeGoal({ deadline: daysFromToday(0) })
    expect(daysUntilDeadline(goal)).toBe(0)
  })
})

describe('sortGoals', () => {
  it('places in_progress goals before completed goals', () => {
    const goals = [
      makeGoal({ id: 'c', status: 'completed' }),
      makeGoal({ id: 'a', status: 'in_progress' }),
    ]
    const sorted = sortGoals(goals)
    expect(sorted[0].id).toBe('a')
    expect(sorted[1].id).toBe('c')
  })

  it('sorts in_progress by priority — high before medium before low', () => {
    const goals = [
      makeGoal({ id: 'low', priority: 'low' }),
      makeGoal({ id: 'high', priority: 'high' }),
      makeGoal({ id: 'med', priority: 'medium' }),
    ]
    const sorted = sortGoals(goals)
    expect(sorted.map(g => g.id)).toEqual(['high', 'med', 'low'])
  })

  it('sorts same-priority goals by deadline (earliest first)', () => {
    const goals = [
      makeGoal({ id: 'later', priority: 'high', deadline: daysFromToday(10) }),
      makeGoal({ id: 'sooner', priority: 'high', deadline: daysFromToday(2) }),
    ]
    const sorted = sortGoals(goals)
    expect(sorted[0].id).toBe('sooner')
  })

  it('places goals with no deadline after those with deadlines (same priority)', () => {
    const goals = [
      makeGoal({ id: 'no-deadline', priority: 'high', deadline: null }),
      makeGoal({ id: 'has-deadline', priority: 'high', deadline: daysFromToday(5) }),
    ]
    const sorted = sortGoals(goals)
    expect(sorted[0].id).toBe('has-deadline')
  })

  it('does not mutate the original array', () => {
    const goals = [
      makeGoal({ id: 'b', priority: 'low' }),
      makeGoal({ id: 'a', priority: 'high' }),
    ]
    const original = [...goals]
    sortGoals(goals)
    expect(goals[0].id).toBe(original[0].id)
  })
})

describe('getCompletionRate', () => {
  it('returns 0 for an empty array', () => {
    expect(getCompletionRate([])).toBe(0)
  })

  it('returns 100 when all goals are completed', () => {
    const goals = [
      makeGoal({ status: 'completed' }),
      makeGoal({ status: 'completed' }),
    ]
    expect(getCompletionRate(goals)).toBe(100)
  })

  it('returns 0 when no goals are completed', () => {
    const goals = [
      makeGoal({ status: 'in_progress' }),
      makeGoal({ status: 'abandoned' }),
    ]
    expect(getCompletionRate(goals)).toBe(0)
  })

  it('returns 50 for half completed', () => {
    const goals = [
      makeGoal({ status: 'completed' }),
      makeGoal({ status: 'in_progress' }),
    ]
    expect(getCompletionRate(goals)).toBe(50)
  })

  it('rounds to nearest integer', () => {
    const goals = [
      makeGoal({ status: 'completed' }),
      makeGoal({ status: 'in_progress' }),
      makeGoal({ status: 'in_progress' }),
    ]
    // 1/3 = 33.33... → 33
    expect(getCompletionRate(goals)).toBe(33)
  })
})
