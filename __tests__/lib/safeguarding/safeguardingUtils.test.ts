import {
  sortConcerns,
  filterConcerns,
  isActiveStatus,
  isConcernCategory,
  isConcernSeverity,
  isConcernStatus,
  severityClasses,
  statusClasses,
  SafeguardingConcern,
} from '@/lib/safeguarding/safeguardingUtils'

function makeConcern(overrides: Partial<SafeguardingConcern> = {}): SafeguardingConcern {
  return {
    id: 'concern-1',
    student_id: 'student-1',
    raised_by: 'admin-1',
    category: 'wellbeing',
    severity: 'medium',
    description: 'Test concern',
    status: 'open',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('isActiveStatus', () => {
  it('returns true for non-closed statuses', () => {
    expect(isActiveStatus('open')).toBe(true)
    expect(isActiveStatus('monitoring')).toBe(true)
    expect(isActiveStatus('escalated')).toBe(true)
  })

  it('returns false for closed', () => {
    expect(isActiveStatus('closed')).toBe(false)
  })
})

describe('sortConcerns', () => {
  it('places escalated before open before monitoring before closed', () => {
    const concerns = [
      makeConcern({ id: 'closed', status: 'closed' }),
      makeConcern({ id: 'monitoring', status: 'monitoring' }),
      makeConcern({ id: 'open', status: 'open' }),
      makeConcern({ id: 'escalated', status: 'escalated' }),
    ]
    const sorted = sortConcerns(concerns)
    expect(sorted.map(c => c.id)).toEqual(['escalated', 'open', 'monitoring', 'closed'])
  })

  it('sorts same-status concerns by severity (high first)', () => {
    const concerns = [
      makeConcern({ id: 'low', status: 'open', severity: 'low' }),
      makeConcern({ id: 'high', status: 'open', severity: 'high' }),
      makeConcern({ id: 'med', status: 'open', severity: 'medium' }),
    ]
    const sorted = sortConcerns(concerns)
    expect(sorted.map(c => c.id)).toEqual(['high', 'med', 'low'])
  })

  it('sorts same status and severity by newest first', () => {
    const concerns = [
      makeConcern({ id: 'older', created_at: '2026-01-01T00:00:00Z' }),
      makeConcern({ id: 'newer', created_at: '2026-02-01T00:00:00Z' }),
    ]
    const sorted = sortConcerns(concerns)
    expect(sorted[0].id).toBe('newer')
  })

  it('does not mutate the original array', () => {
    const concerns = [
      makeConcern({ id: 'closed', status: 'closed' }),
      makeConcern({ id: 'escalated', status: 'escalated' }),
    ]
    const original = [...concerns]
    sortConcerns(concerns)
    expect(concerns[0].id).toBe(original[0].id)
  })
})

describe('filterConcerns', () => {
  const concerns = [
    makeConcern({ id: 'a', status: 'open', severity: 'high' }),
    makeConcern({ id: 'b', status: 'closed', severity: 'low' }),
    makeConcern({ id: 'c', status: 'open', severity: 'low' }),
  ]

  it('returns all when filters are "all"', () => {
    expect(filterConcerns(concerns, { status: 'all', severity: 'all' })).toHaveLength(3)
  })

  it('filters by status', () => {
    const result = filterConcerns(concerns, { status: 'open' })
    expect(result.map(c => c.id)).toEqual(['a', 'c'])
  })

  it('filters by severity', () => {
    const result = filterConcerns(concerns, { severity: 'low' })
    expect(result.map(c => c.id)).toEqual(['b', 'c'])
  })

  it('combines status and severity filters', () => {
    const result = filterConcerns(concerns, { status: 'open', severity: 'low' })
    expect(result.map(c => c.id)).toEqual(['c'])
  })
})

describe('type guards', () => {
  it('isConcernCategory validates known categories', () => {
    expect(isConcernCategory('wellbeing')).toBe(true)
    expect(isConcernCategory('nonsense')).toBe(false)
    expect(isConcernCategory(42)).toBe(false)
  })

  it('isConcernSeverity validates known severities', () => {
    expect(isConcernSeverity('high')).toBe(true)
    expect(isConcernSeverity('critical')).toBe(false)
    expect(isConcernSeverity(null)).toBe(false)
  })

  it('isConcernStatus validates known statuses', () => {
    expect(isConcernStatus('escalated')).toBe(true)
    expect(isConcernStatus('archived')).toBe(false)
    expect(isConcernStatus(undefined)).toBe(false)
  })
})

describe('badge class helpers', () => {
  it('returns a non-empty class string for every severity', () => {
    expect(severityClasses('high')).toContain('red')
    expect(severityClasses('medium')).toContain('amber')
    expect(severityClasses('low')).toContain('emerald')
  })

  it('returns a non-empty class string for every status', () => {
    expect(statusClasses('open')).toContain('blue')
    expect(statusClasses('escalated')).toContain('red')
    expect(statusClasses('closed')).toContain('gray')
  })
})
