import { getStatusLabel, getStatusColor } from '@/lib/utils'

describe('submission status helpers', () => {
  it('returns correct label for each status', () => {
    expect(getStatusLabel('not_started')).toBe('Not Started')
    expect(getStatusLabel('in_progress')).toBe('In Progress')
    expect(getStatusLabel('submitted')).toBe('Submitted')
    expect(getStatusLabel('graded')).toBe('Graded')
  })

  it('returns a non-empty color class for each status', () => {
    const statuses = ['not_started', 'in_progress', 'submitted', 'graded'] as const
    for (const s of statuses) {
      expect(getStatusColor(s).length).toBeGreaterThan(0)
    }
  })
})
