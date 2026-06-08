export const REVIEW_QUESTIONS = [
  { key: 'attendance_rating',    label: 'Attendance & Punctuality Rating', type: 'scale' as const },
  { key: 'academic_engagement',  label: 'Academic Engagement Rating',      type: 'scale' as const },
  { key: 'football_development', label: 'Football Development Rating',     type: 'scale' as const },
  { key: 'wellbeing_overall',    label: 'Overall Wellbeing Rating',        type: 'scale' as const },
  { key: 'academic_strengths',   label: 'Academic strengths this term',    type: 'text' as const },
  { key: 'academic_improvements',label: 'Academic areas to improve',       type: 'text' as const },
  { key: 'football_strengths',   label: 'Football strengths this term',    type: 'text' as const },
  { key: 'football_improvements',label: 'Football development areas',      type: 'text' as const },
  { key: 'support_needs',        label: 'Support needs identified',        type: 'text' as const },
  { key: 'agreed_targets',       label: 'Agreed targets for next term',    type: 'text' as const },
] as const

export type ReviewQuestion = (typeof REVIEW_QUESTIONS)[number]
export type ReviewKey = ReviewQuestion['key']

export const SCALE_QUESTIONS = REVIEW_QUESTIONS.filter(q => q.type === 'scale')
export const TEXT_QUESTIONS  = REVIEW_QUESTIONS.filter(q => q.type === 'text')

export function validateReviewAnswers(answers: Record<string, string | number>): boolean {
  for (const q of REVIEW_QUESTIONS) {
    const val = answers[q.key]
    if (val === undefined || val === null) return false
    if (q.type === 'scale') {
      const n = Number(val)
      if (!Number.isInteger(n) || n < 1 || n > 5) return false
    } else {
      if (typeof val !== 'string' || val.trim().length === 0) return false
    }
  }
  return true
}

export function extractScaleAnswers(answers: Record<string, string | number>): Record<string, number> {
  const result: Record<string, number> = {}
  for (const q of SCALE_QUESTIONS) {
    if (answers[q.key] !== undefined) {
      result[q.key] = Number(answers[q.key])
    }
  }
  return result
}

export function buildReviewSummaryPrompt(
  studentName: string,
  term: string,
  answers: Record<string, string | number>,
  context?: {
    attendancePct?: number
    submittedUnits?: number
    totalUnits?: number
    wellbeingScores?: Record<string, number>
  }
): string {
  const lines: string[] = [
    `You are an academy coach writing a structured learner review summary for ${studentName} (${term} term).`,
    '',
    'Review data collected during the 1-to-1:',
  ]

  for (const q of REVIEW_QUESTIONS) {
    const val = answers[q.key]
    const display = q.type === 'scale' ? `${val}/5` : val
    lines.push(`- ${q.label}: ${display}`)
  }

  if (context) {
    lines.push('')
    lines.push('Additional data from the platform:')
    if (context.attendancePct !== undefined) lines.push(`- Attendance this term: ${context.attendancePct}%`)
    if (context.submittedUnits !== undefined && context.totalUnits !== undefined) {
      lines.push(`- Coursework: ${context.submittedUnits}/${context.totalUnits} units submitted`)
    }
    if (context.wellbeingScores) {
      const entries = Object.entries(context.wellbeingScores).map(([k, v]) => `${k}: ${v}/5`).join(', ')
      lines.push(`- Latest wellbeing scores: ${entries}`)
    }
  }

  lines.push('')
  lines.push('Write a structured summary with these sections:')
  lines.push('1. Attendance & Punctuality')
  lines.push('2. Academic Progress')
  lines.push('3. Football Development')
  lines.push('4. Wellbeing & Pastoral')
  lines.push('5. Support Needs')
  lines.push('6. Agreed Actions & Targets')
  lines.push('')
  lines.push('Be concise, professional, and specific. Use the data above. Maximum 400 words.')

  return lines.join('\n')
}
