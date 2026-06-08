import { getStatusLabel, isOverdue, sortPlans, IdpPlan, IdpStatus } from '@/lib/idp/idpUtils'

function makePlan(overrides: Partial<IdpPlan> = {}): IdpPlan {
  return {
    id: 'test-id',
    student_id: 'student-1',
    title: 'Test Plan',
    description: null,
    target_date: null,
    status: 'active',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('getStatusLabel', () => {
  it('returns Active for active status', () => {
    expect(getStatusLabel('active')).toBe('Active')
  })

  it('returns Completed for completed status', () => {
    expect(getStatusLabel('completed')).toBe('Completed')
  })

  it('returns Paused for paused status', () => {
    expect(getStatusLabel('paused')).toBe('Paused')
  })
})

describe('isOverdue', () => {
  const now = new Date('2024-06-15T12:00:00Z')

  it('returns false when status is not active', () => {
    const plan = makePlan({ status: 'completed', target_date: '2024-01-01' })
    expect(isOverdue(plan, now)).toBe(false)
  })

  it('returns false for paused plans with past target_date', () => {
    const plan = makePlan({ status: 'paused', target_date: '2024-01-01' })
    expect(isOverdue(plan, now)).toBe(false)
  })

  it('returns false when target_date is null', () => {
    const plan = makePlan({ status: 'active', target_date: null })
    expect(isOverdue(plan, now)).toBe(false)
  })

  it('returns true when active plan target_date is before today', () => {
    const plan = makePlan({ status: 'active', target_date: '2024-06-10' })
    expect(isOverdue(plan, now)).toBe(true)
  })

  it('returns false when active plan target_date is today', () => {
    const plan = makePlan({ status: 'active', target_date: '2024-06-15' })
    expect(isOverdue(plan, now)).toBe(false)
  })

  it('returns false when active plan target_date is in the future', () => {
    const plan = makePlan({ status: 'active', target_date: '2024-12-31' })
    expect(isOverdue(plan, now)).toBe(false)
  })

  it('uses current date by default', () => {
    // A plan with target_date well in the past is always overdue
    const plan = makePlan({ status: 'active', target_date: '2000-01-01' })
    expect(isOverdue(plan)).toBe(true)
  })
})

describe('sortPlans', () => {
  it('puts active plans before completed plans', () => {
    const completed = makePlan({ id: 'c1', status: 'completed' })
    const active = makePlan({ id: 'a1', status: 'active' })
    const result = sortPlans([completed, active])
    expect(result[0].id).toBe('a1')
    expect(result[1].id).toBe('c1')
  })

  it('puts active plans before paused plans', () => {
    const paused = makePlan({ id: 'p1', status: 'paused' })
    const active = makePlan({ id: 'a1', status: 'active' })
    const result = sortPlans([paused, active])
    expect(result[0].id).toBe('a1')
  })

  it('puts completed plans before paused plans', () => {
    const paused = makePlan({ id: 'p1', status: 'paused' })
    const completed = makePlan({ id: 'c1', status: 'completed' })
    const result = sortPlans([paused, completed])
    expect(result[0].id).toBe('c1')
  })

  it('sorts active plans by target_date asc', () => {
    const a1 = makePlan({ id: 'a1', status: 'active', target_date: '2024-12-01' })
    const a2 = makePlan({ id: 'a2', status: 'active', target_date: '2024-06-01' })
    const result = sortPlans([a1, a2])
    expect(result[0].id).toBe('a2')
    expect(result[1].id).toBe('a1')
  })

  it('puts active plans with null target_date after those with a date', () => {
    const withDate = makePlan({ id: 'a1', status: 'active', target_date: '2024-06-01' })
    const noDate = makePlan({ id: 'a2', status: 'active', target_date: null })
    const result = sortPlans([noDate, withDate])
    expect(result[0].id).toBe('a1')
    expect(result[1].id).toBe('a2')
  })

  it('does not mutate the original array', () => {
    const plans = [
      makePlan({ id: 'c1', status: 'completed' }),
      makePlan({ id: 'a1', status: 'active' }),
    ]
    const original = [...plans]
    sortPlans(plans)
    expect(plans[0].id).toBe(original[0].id)
  })

  it('handles an empty array', () => {
    expect(sortPlans([])).toEqual([])
  })
})
