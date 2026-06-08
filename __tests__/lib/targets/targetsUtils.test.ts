import { extractTargets, hasAnyTargets, type ReviewTargets } from '@/lib/targets/targetsUtils'

const baseReview = {
  id: 'rev-1',
  term: 'Autumn 2025',
  completed_at: '2025-11-15T10:00:00Z',
  status: 'complete' as const,
}

const baseAnswers = [
  { question_key: 'agreed_targets', answer: 'Improve passing accuracy' },
  { question_key: 'support_needs', answer: 'Extra coaching sessions' },
  { question_key: 'academic_improvements', answer: 'Submit assignments on time' },
  { question_key: 'football_improvements', answer: 'Work on defensive positioning' },
  { question_key: 'academic_strengths', answer: 'Good essay writing' },
  { question_key: 'football_strengths', answer: 'Strong in the air' },
]

describe('extractTargets', () => {
  it('maps review metadata correctly', () => {
    const result = extractTargets(baseReview, baseAnswers)
    expect(result.reviewId).toBe('rev-1')
    expect(result.term).toBe('Autumn 2025')
    expect(result.completedAt).toBe('2025-11-15T10:00:00Z')
  })

  it('maps all four target fields from answers', () => {
    const result = extractTargets(baseReview, baseAnswers)
    expect(result.agreedTargets).toBe('Improve passing accuracy')
    expect(result.supportNeeds).toBe('Extra coaching sessions')
    expect(result.academicImprovements).toBe('Submit assignments on time')
    expect(result.footballImprovements).toBe('Work on defensive positioning')
  })

  it('returns null for a missing question key', () => {
    const answers = baseAnswers.filter(a => a.question_key !== 'agreed_targets')
    const result = extractTargets(baseReview, answers)
    expect(result.agreedTargets).toBeNull()
    expect(result.supportNeeds).toBe('Extra coaching sessions')
  })

  it('returns null for all fields when answers array is empty', () => {
    const result = extractTargets(baseReview, [])
    expect(result.agreedTargets).toBeNull()
    expect(result.supportNeeds).toBeNull()
    expect(result.academicImprovements).toBeNull()
    expect(result.footballImprovements).toBeNull()
  })

  it('handles null completed_at', () => {
    const review = { ...baseReview, completed_at: null }
    const result = extractTargets(review, baseAnswers)
    expect(result.completedAt).toBeNull()
  })

  it('ignores non-target question keys (e.g. strengths)', () => {
    // strengths are present in answers but should not appear on ReviewTargets
    const result = extractTargets(baseReview, baseAnswers)
    expect(result).not.toHaveProperty('academicStrengths')
    expect(result).not.toHaveProperty('footballStrengths')
  })
})

describe('hasAnyTargets', () => {
  it('returns true when at least one field is populated', () => {
    const targets: ReviewTargets = {
      reviewId: 'rev-1',
      term: 'Autumn 2025',
      completedAt: null,
      agreedTargets: 'Some target',
      supportNeeds: null,
      academicImprovements: null,
      footballImprovements: null,
    }
    expect(hasAnyTargets(targets)).toBe(true)
  })

  it('returns false when all four fields are null', () => {
    const targets: ReviewTargets = {
      reviewId: 'rev-1',
      term: 'Autumn 2025',
      completedAt: null,
      agreedTargets: null,
      supportNeeds: null,
      academicImprovements: null,
      footballImprovements: null,
    }
    expect(hasAnyTargets(targets)).toBe(false)
  })

  it('returns true when only footballImprovements is set', () => {
    const targets: ReviewTargets = {
      reviewId: 'rev-2',
      term: 'Spring 2026',
      completedAt: '2026-03-01T00:00:00Z',
      agreedTargets: null,
      supportNeeds: null,
      academicImprovements: null,
      footballImprovements: 'Improve stamina',
    }
    expect(hasAnyTargets(targets)).toBe(true)
  })

  it('treats empty string as falsy (no targets)', () => {
    const targets: ReviewTargets = {
      reviewId: 'rev-3',
      term: 'Summer 2026',
      completedAt: null,
      agreedTargets: '',
      supportNeeds: '',
      academicImprovements: '',
      footballImprovements: '',
    }
    expect(hasAnyTargets(targets)).toBe(false)
  })
})
