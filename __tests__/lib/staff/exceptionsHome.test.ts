import { buildReviewsDue } from '@/lib/staff/exceptionsHome'

const TODAY = '2026-09-16'

describe('buildReviewsDue', () => {
  it('includes an upcoming review within the horizon', () => {
    const result = buildReviewsDue(
      [{ id: 'r1', student_id: 's1', name: 'Alex', status: 'draft', scheduled_for: '2026-09-20' }],
      TODAY,
    )
    expect(result).toEqual([{ id: 'r1', studentId: 's1', name: 'Alex', scheduledFor: '2026-09-20', overdue: false }])
  })

  it('marks a past-dated review as overdue', () => {
    const result = buildReviewsDue(
      [{ id: 'r2', student_id: 's2', name: 'Sam', status: 'submitted', scheduled_for: '2026-09-01' }],
      TODAY,
    )
    expect(result[0].overdue).toBe(true)
  })

  it('excludes a completed review even if its date is in range', () => {
    const result = buildReviewsDue(
      [{ id: 'r3', student_id: 's3', name: 'Jo', status: 'complete', scheduled_for: '2026-09-18' }],
      TODAY,
    )
    expect(result).toHaveLength(0)
  })

  it('excludes a review with no scheduled date', () => {
    const result = buildReviewsDue(
      [{ id: 'r4', student_id: 's4', name: 'Kim', status: 'draft', scheduled_for: null }],
      TODAY,
    )
    expect(result).toHaveLength(0)
  })

  it('sorts soonest/most-overdue first', () => {
    const result = buildReviewsDue(
      [
        { id: 'later', student_id: 's1', name: 'A', status: 'draft', scheduled_for: '2026-09-25' },
        { id: 'overdue', student_id: 's2', name: 'B', status: 'draft', scheduled_for: '2026-09-01' },
        { id: 'soon', student_id: 's3', name: 'C', status: 'draft', scheduled_for: '2026-09-17' },
      ],
      TODAY,
    )
    expect(result.map(r => r.id)).toEqual(['overdue', 'soon', 'later'])
  })

  it('returns empty for an empty roster', () => {
    expect(buildReviewsDue([], TODAY)).toEqual([])
  })
})
