import {
  isFortnightlyWeek,
  getRedFlags,
  validateSurveyAnswers,
  SURVEY_QUESTIONS,
} from '@/lib/wellbeing/wellbeingUtils'

const ALL_KEYS = SURVEY_QUESTIONS.map(q => q.key)

describe('isFortnightlyWeek', () => {
  it('returns true on ISO week 1 (odd)', () => {
    // 2024-01-01 is ISO week 1 — Monday
    expect(isFortnightlyWeek(new Date('2024-01-01T12:00:00Z'))).toBe(true)
  })

  it('returns false on ISO week 2 (even)', () => {
    // 2024-01-08 is ISO week 2
    expect(isFortnightlyWeek(new Date('2024-01-08T12:00:00Z'))).toBe(false)
  })

  it('returns true on ISO week 3 (odd)', () => {
    // 2024-01-15 is ISO week 3
    expect(isFortnightlyWeek(new Date('2024-01-15T12:00:00Z'))).toBe(true)
  })

  it('returns false on ISO week 4 (even)', () => {
    // 2024-01-22 is ISO week 4
    expect(isFortnightlyWeek(new Date('2024-01-22T12:00:00Z'))).toBe(false)
  })

  it('same-week mid-week date gives same result as Monday', () => {
    // 2024-01-03 Wednesday is still week 1 — should match Monday
    expect(isFortnightlyWeek(new Date('2024-01-03T12:00:00Z'))).toBe(
      isFortnightlyWeek(new Date('2024-01-01T12:00:00Z'))
    )
  })
})

describe('getRedFlags', () => {
  it('returns empty array when all scores are above threshold', () => {
    const responses = [
      { question_key: 'mood',  score: 3 },
      { question_key: 'stress', score: 3 },
    ]
    expect(getRedFlags(responses)).toEqual([])
  })

  it('flags mood score of 2 (≤ 2)', () => {
    const responses = [{ question_key: 'mood', score: 2 }]
    expect(getRedFlags(responses)).toHaveLength(1)
    expect(getRedFlags(responses)[0].question_key).toBe('mood')
  })

  it('flags mood score of 1', () => {
    expect(getRedFlags([{ question_key: 'mood', score: 1 }])).toHaveLength(1)
  })

  it('does NOT flag mood score of 3', () => {
    expect(getRedFlags([{ question_key: 'mood', score: 3 }])).toHaveLength(0)
  })

  it('flags stress score of 2 (≤ 2 means severely low energy/mood on that axis)', () => {
    expect(getRedFlags([{ question_key: 'stress', score: 2 }])).toHaveLength(1)
  })

  it('does NOT flag sleep at score 2 (not a safeguarding key)', () => {
    expect(getRedFlags([{ question_key: 'sleep', score: 2 }])).toHaveLength(0)
  })

  it('does NOT flag energy at score 2', () => {
    expect(getRedFlags([{ question_key: 'energy', score: 2 }])).toHaveLength(0)
  })

  it('does NOT flag football_enjoyment at score 2', () => {
    expect(getRedFlags([{ question_key: 'football_enjoyment', score: 2 }])).toHaveLength(0)
  })

  it('flags multiple red-flag keys at once', () => {
    const responses = [
      { question_key: 'mood',   score: 1 },
      { question_key: 'stress', score: 2 },
      { question_key: 'sleep',  score: 1 }, // not flagged
    ]
    expect(getRedFlags(responses)).toHaveLength(2)
  })
})

describe('validateSurveyAnswers', () => {
  it('returns true when all questions answered with scores 1-5', () => {
    const answers = Object.fromEntries(ALL_KEYS.map(k => [k, 3]))
    expect(validateSurveyAnswers(answers)).toBe(true)
  })

  it('returns false when a question key is missing', () => {
    const answers = Object.fromEntries(ALL_KEYS.slice(0, -1).map(k => [k, 3]))
    expect(validateSurveyAnswers(answers)).toBe(false)
  })

  it('returns false when a score is 0 (below minimum)', () => {
    const answers = Object.fromEntries(ALL_KEYS.map(k => [k, 3]))
    answers[ALL_KEYS[0]] = 0
    expect(validateSurveyAnswers(answers)).toBe(false)
  })

  it('returns false when a score is 6 (above maximum)', () => {
    const answers = Object.fromEntries(ALL_KEYS.map(k => [k, 3]))
    answers[ALL_KEYS[1]] = 6
    expect(validateSurveyAnswers(answers)).toBe(false)
  })

  it('accepts minimum boundary score of 1', () => {
    const answers = Object.fromEntries(ALL_KEYS.map(k => [k, 1]))
    expect(validateSurveyAnswers(answers)).toBe(true)
  })

  it('accepts maximum boundary score of 5', () => {
    const answers = Object.fromEntries(ALL_KEYS.map(k => [k, 5]))
    expect(validateSurveyAnswers(answers)).toBe(true)
  })

  it('returns false for empty object', () => {
    expect(validateSurveyAnswers({})).toBe(false)
  })
})
