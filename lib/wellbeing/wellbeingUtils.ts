export const SURVEY_QUESTIONS = [
  { key: 'mood',               label: 'How is your mood today?',         emoji: '😊' },
  { key: 'sleep',              label: 'How well did you sleep?',          emoji: '😴' },
  { key: 'energy',             label: 'How are your energy levels?',      emoji: '⚡' },
  { key: 'stress',             label: 'How stressed are you feeling?',    emoji: '😰' },
  { key: 'football_enjoyment', label: 'How much did you enjoy football?', emoji: '⚽' },
] as const

export type QuestionKey = typeof SURVEY_QUESTIONS[number]['key']

export type SurveyResponse = {
  question_key: string
  score: number
}

// Red-flag keys: mood and stress are safeguarding-sensitive.
// Every other question is answered "higher = better" (e.g. great mood, great sleep).
// `stress` is the one question where a HIGH score means a bad outcome ("How stressed
// are you feeling?" — 5 = extremely stressed), so it must be normalized before it's
// compared, averaged, or color-coded alongside the rest.
const RED_FLAG_KEYS: Set<string> = new Set(['mood', 'stress'])
const INVERTED_KEYS: Set<string> = new Set(['stress'])
const RED_FLAG_THRESHOLD = 2

/**
 * Converts a raw 1-5 answer into a "higher = better wellbeing" scale so it can be
 * safely compared/averaged/colored against every other question's score.
 */
export function normalizedScore(key: string, score: number): number {
  return INVERTED_KEYS.has(key) ? 6 - score : score
}

/** Returns true on odd ISO weeks (1, 3, 5...) — the fortnightly fire weeks */
export function isFortnightlyWeek(date: Date): boolean {
  // ISO week: Thursday determines the week year
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = d.getUTCDay() || 7 // make Sunday = 7
  d.setUTCDate(d.getUTCDate() + 4 - day) // move to Thursday
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return weekNo % 2 !== 0
}

/** Returns responses that should trigger a pastoral alert */
export function getRedFlags(responses: SurveyResponse[]): SurveyResponse[] {
  return responses.filter(
    r => RED_FLAG_KEYS.has(r.question_key) && normalizedScore(r.question_key, r.score) <= RED_FLAG_THRESHOLD
  )
}

export type SurveyTrendPoint = {
  sentAt: string
  avg: number
}

/** Converts an array of surveys (each with responses) into avg-score trend points */
export function buildWellbeingTrend(
  surveys: Array<{ sent_at: string; wellbeing_responses: { question_key?: string; score: number }[] }>
): SurveyTrendPoint[] {
  return surveys.map(s => {
    const scores = s.wellbeing_responses.map(r =>
      r.question_key ? normalizedScore(r.question_key, r.score) : r.score
    )
    const avg = scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) / 10
      : 0
    return { sentAt: s.sent_at, avg }
  })
}

const GENERIC_SCORE_LABELS = ['', 'Very Low', 'Low', 'Okay', 'Good', 'Great']
const STRESS_SCORE_LABELS = ['', 'Not at all', 'A little', 'Moderately', 'Very', 'Extremely']

/** Question-aware label for a raw 1-5 score — stress reads as "how much", not "how good" */
export function getScoreLabel(key: string, score: number): string {
  const labels = key === 'stress' ? STRESS_SCORE_LABELS : GENERIC_SCORE_LABELS
  return labels[score] ?? ''
}

/** Validates all 5 survey questions are answered with scores 1-5 */
export function validateSurveyAnswers(answers: Record<string, number>): boolean {
  return SURVEY_QUESTIONS.every(q => {
    const score = answers[q.key]
    return typeof score === 'number' && score >= 1 && score <= 5
  })
}
