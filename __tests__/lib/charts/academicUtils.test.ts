import { buildAcademicCounts } from '@/lib/charts/academicUtils'

describe('buildAcademicCounts', () => {
  it('returns zeros for empty array', () => {
    expect(buildAcademicCounts([])).toEqual({ complete: 0, inProgress: 0, notStarted: 0 })
  })

  it('counts graded submissions as complete', () => {
    const result = buildAcademicCounts([
      { assignment_id: '1', status: 'graded' },
      { assignment_id: '2', status: 'graded' },
    ])
    expect(result.complete).toBe(2)
    expect(result.inProgress).toBe(0)
    expect(result.notStarted).toBe(0)
  })

  it('counts submitted submissions as complete', () => {
    const result = buildAcademicCounts([
      { assignment_id: '1', status: 'submitted' },
    ])
    expect(result.complete).toBe(1)
  })

  it('counts both submitted and graded together in complete', () => {
    const result = buildAcademicCounts([
      { assignment_id: '1', status: 'submitted' },
      { assignment_id: '2', status: 'graded' },
      { assignment_id: '3', status: 'graded' },
    ])
    expect(result.complete).toBe(3)
  })

  it('counts in_progress submissions correctly', () => {
    const result = buildAcademicCounts([
      { assignment_id: '1', status: 'in_progress' },
      { assignment_id: '2', status: 'in_progress' },
    ])
    expect(result.inProgress).toBe(2)
    expect(result.complete).toBe(0)
    expect(result.notStarted).toBe(0)
  })

  it('counts not_started submissions correctly', () => {
    const result = buildAcademicCounts([
      { assignment_id: '1', status: 'not_started' },
    ])
    expect(result.notStarted).toBe(1)
    expect(result.complete).toBe(0)
    expect(result.inProgress).toBe(0)
  })

  it('handles a mixed set across all statuses', () => {
    const result = buildAcademicCounts([
      { assignment_id: '1', status: 'graded' },
      { assignment_id: '2', status: 'submitted' },
      { assignment_id: '3', status: 'in_progress' },
      { assignment_id: '4', status: 'not_started' },
      { assignment_id: '5', status: 'not_started' },
    ])
    expect(result.complete).toBe(2)
    expect(result.inProgress).toBe(1)
    expect(result.notStarted).toBe(2)
  })

  it('total across all categories equals input length', () => {
    const subs = [
      { assignment_id: '1', status: 'graded' as const },
      { assignment_id: '2', status: 'in_progress' as const },
      { assignment_id: '3', status: 'not_started' as const },
    ]
    const result = buildAcademicCounts(subs)
    expect(result.complete + result.inProgress + result.notStarted).toBe(subs.length)
  })
})
