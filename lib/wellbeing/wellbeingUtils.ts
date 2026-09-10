export const SURVEY_QUESTIONS = [
  { key: 'mood',               label: 'How is your mood today?',         emoji: '😊' },
  { key: 'sleep',              label: 'How well did you sleep?',          emoji: '😴' },
  { key: 'energy',             label: 'How are your energy levels?',      emoji: '⚡' },
  { key: 'stress',             label: 'How stressed are you feeling?',    emoji: '😰' },
  { key: 'connection',         label: 'How connected have you felt to people around you?', emoji: '🤝' },
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
// `connection` is deliberately NOT a red-flag key yet — it's a brand-new item and
// stays observation-only until there's a term's worth of real data to know it isn't
// just adding noise to staff alerts (docs/research/2026-09-10-checkin-question-quality-research.md).
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
const CONNECTION_SCORE_LABELS = ['', 'Not at all', 'A little', 'Fairly', 'Very', 'Completely']

/** Question-aware label for a raw 1-5 score — stress/connection read as "how much", not "how good" */
export function getScoreLabel(key: string, score: number): string {
  const labels =
    key === 'stress' ? STRESS_SCORE_LABELS :
    key === 'connection' ? CONNECTION_SCORE_LABELS :
    GENERIC_SCORE_LABELS
  return labels[score] ?? ''
}

/** Validates every survey question is answered with a score 1-5 */
export function validateSurveyAnswers(answers: Record<string, number>): boolean {
  return SURVEY_QUESTIONS.every(q => {
    const score = answers[q.key]
    return typeof score === 'number' && score >= 1 && score <= 5
  })
}

/**
 * The fixed set of context tags a student can pick after the scored questions —
 * "what's been on your mind" — not scored, never flag-eligible on its own. Its job
 * is to make a low score routable (coursework → tutor, home → DSL, health → physio).
 * Keep in sync with the DB check constraint in
 * supabase/migrations/065_wellbeing_context_tags.sql — this is the single source of
 * truth for both the student-facing picker and the admin badge display.
 */
export const CONTEXT_TAGS = [
  { key: 'football',       label: 'Football',        emoji: '⚽' },
  { key: 'college',        label: 'College work',    emoji: '📚' },
  { key: 'home',           label: 'Home',             emoji: '🏠' },
  { key: 'friends',        label: 'Friends',          emoji: '👥' },
  { key: 'money',          label: 'Money',            emoji: '💷' },
  { key: 'health',         label: 'Health or injury', emoji: '🩹' },
  { key: 'something_else', label: 'Something else',   emoji: '🤔' },
  { key: 'nothing_much',   label: 'Nothing much',     emoji: '🙂' },
] as const

export type ContextTagKey = typeof CONTEXT_TAGS[number]['key']

/** True if `tags` is at most 2 valid context-tag keys. Mirrors the DB check constraint. */
export function isValidContextTags(tags: unknown): tags is ContextTagKey[] {
  if (!Array.isArray(tags)) return false
  if (tags.length > 2) return false
  const validKeys = new Set<string>(CONTEXT_TAGS.map(t => t.key))
  return tags.every(t => typeof t === 'string' && validKeys.has(t))
}
