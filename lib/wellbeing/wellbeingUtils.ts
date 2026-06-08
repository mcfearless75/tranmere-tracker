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

// Red-flag keys: mood and stress are safeguarding-sensitive
const RED_FLAG_KEYS: Set<string> = new Set(['mood', 'stress'])
const RED_FLAG_THRESHOLD = 2

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
    r => RED_FLAG_KEYS.has(r.question_key) && r.score <= RED_FLAG_THRESHOLD
  )
}

/** Validates all 5 survey questions are answered with scores 1-5 */
export function validateSurveyAnswers(answers: Record<string, number>): boolean {
  return SURVEY_QUESTIONS.every(q => {
    const score = answers[q.key]
    return typeof score === 'number' && score >= 1 && score <= 5
  })
}
