import {
  REVIEW_QUESTIONS,
  SCALE_QUESTIONS,
  TEXT_QUESTIONS,
  validateReviewAnswers,
  extractScaleAnswers,
  buildReviewSummaryPrompt,
  canMarkComplete,
} from '@/lib/learnerReview/reviewUtils'

describe('REVIEW_QUESTIONS', () => {
  it('has exactly 10 questions', () => {
    expect(REVIEW_QUESTIONS).toHaveLength(10)
  })

  it('has unique keys', () => {
    const keys = REVIEW_QUESTIONS.map(q => q.key)
    expect(new Set(keys).size).toBe(10)
  })

  it('each question has key, label, and type', () => {
    for (const q of REVIEW_QUESTIONS) {
      expect(q.key).toBeTruthy()
      expect(q.label).toBeTruthy()
      expect(['scale', 'text']).toContain(q.type)
    }
  })
})

describe('SCALE_QUESTIONS / TEXT_QUESTIONS', () => {
  it('SCALE_QUESTIONS are all type=scale', () => {
    expect(SCALE_QUESTIONS.every(q => q.type === 'scale')).toBe(true)
  })

  it('TEXT_QUESTIONS are all type=text', () => {
    expect(TEXT_QUESTIONS.every(q => q.type === 'text')).toBe(true)
  })

  it('SCALE + TEXT = full set', () => {
    expect(SCALE_QUESTIONS.length + TEXT_QUESTIONS.length).toBe(10)
  })
})

describe('validateReviewAnswers', () => {
  function makeValid(): Record<string, string | number> {
    const answers: Record<string, string | number> = {}
    for (const q of REVIEW_QUESTIONS) {
      answers[q.key] = q.type === 'scale' ? 3 : 'Some answer text'
    }
    return answers
  }

  it('returns true for valid complete answers', () => {
    expect(validateReviewAnswers(makeValid())).toBe(true)
  })

  it('returns false when a key is missing', () => {
    const answers = makeValid()
    delete answers[REVIEW_QUESTIONS[0].key]
    expect(validateReviewAnswers(answers)).toBe(false)
  })

  it('returns false when a scale answer is out of range (0)', () => {
    const answers = makeValid()
    const scaleKey = SCALE_QUESTIONS[0].key
    answers[scaleKey] = 0
    expect(validateReviewAnswers(answers)).toBe(false)
  })

  it('returns false when a scale answer is out of range (6)', () => {
    const answers = makeValid()
    const scaleKey = SCALE_QUESTIONS[0].key
    answers[scaleKey] = 6
    expect(validateReviewAnswers(answers)).toBe(false)
  })

  it('returns false when a text answer is empty string', () => {
    const answers = makeValid()
    const textKey = TEXT_QUESTIONS[0].key
    answers[textKey] = ''
    expect(validateReviewAnswers(answers)).toBe(false)
  })

  it('returns false when a text answer is whitespace only', () => {
    const answers = makeValid()
    const textKey = TEXT_QUESTIONS[0].key
    answers[textKey] = '   '
    expect(validateReviewAnswers(answers)).toBe(false)
  })

  it('accepts scale answers at boundaries (1 and 5)', () => {
    const a1 = makeValid()
    const a5 = makeValid()
    SCALE_QUESTIONS.forEach(q => { a1[q.key] = 1; a5[q.key] = 5 })
    expect(validateReviewAnswers(a1)).toBe(true)
    expect(validateReviewAnswers(a5)).toBe(true)
  })
})

describe('extractScaleAnswers', () => {
  it('returns only the scale answers as numbers', () => {
    const answers: Record<string, string | number> = {}
    for (const q of REVIEW_QUESTIONS) {
      answers[q.key] = q.type === 'scale' ? 4 : 'Text'
    }
    const scales = extractScaleAnswers(answers)
    expect(Object.keys(scales)).toHaveLength(SCALE_QUESTIONS.length)
    for (const key of Object.keys(scales)) {
      expect(typeof scales[key]).toBe('number')
    }
  })

  it('does not include text question keys', () => {
    const answers: Record<string, string | number> = {}
    for (const q of REVIEW_QUESTIONS) {
      answers[q.key] = q.type === 'scale' ? 3 : 'Some text'
    }
    const scales = extractScaleAnswers(answers)
    for (const q of TEXT_QUESTIONS) {
      expect(scales).not.toHaveProperty(q.key)
    }
  })
})

describe('canMarkComplete', () => {
  it('returns { ok: true } for submitted status', () => {
    expect(canMarkComplete('submitted')).toEqual({ ok: true })
  })

  it('returns { ok: false } with error for already complete', () => {
    const result = canMarkComplete('complete')
    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('returns { ok: false } with error for draft status', () => {
    const result = canMarkComplete('draft')
    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('returns { ok: false } for unknown status', () => {
    expect(canMarkComplete('pending').ok).toBe(false)
  })
})

describe('buildReviewSummaryPrompt', () => {
  const studentName = 'Jamie Clarke'
  const term = 'Autumn 2025'
  const answers: Record<string, string | number> = {}
  beforeAll(() => {
    for (const q of REVIEW_QUESTIONS) {
      answers[q.key] = q.type === 'scale' ? 4 : 'Really good progress this term'
    }
  })

  it('includes the student name', () => {
    const prompt = buildReviewSummaryPrompt(studentName, term, answers)
    expect(prompt).toContain('Jamie Clarke')
  })

  it('includes the term', () => {
    const prompt = buildReviewSummaryPrompt(studentName, term, answers)
    expect(prompt).toContain('Autumn 2025')
  })

  it('includes each question label', () => {
    const prompt = buildReviewSummaryPrompt(studentName, term, answers)
    for (const q of REVIEW_QUESTIONS) {
      expect(prompt).toContain(q.label)
    }
  })

  it('returns a non-empty string', () => {
    const prompt = buildReviewSummaryPrompt(studentName, term, answers)
    expect(typeof prompt).toBe('string')
    expect(prompt.length).toBeGreaterThan(100)
  })
})
