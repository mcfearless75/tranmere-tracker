export type ReviewTargets = {
  reviewId: string
  term: string
  completedAt: string | null
  agreedTargets: string | null
  supportNeeds: string | null
  academicImprovements: string | null
  footballImprovements: string | null
}

type ReviewRow = {
  id: string
  term: string
  completed_at: string | null
  status: string
}

type AnswerRow = {
  question_key: string
  answer: string
}

function pickAnswer(answers: AnswerRow[], key: string): string | null {
  return answers.find(a => a.question_key === key)?.answer ?? null
}

export function extractTargets(review: ReviewRow, answers: AnswerRow[]): ReviewTargets {
  return {
    reviewId: review.id,
    term: review.term,
    completedAt: review.completed_at,
    agreedTargets: pickAnswer(answers, 'agreed_targets'),
    supportNeeds: pickAnswer(answers, 'support_needs'),
    academicImprovements: pickAnswer(answers, 'academic_improvements'),
    footballImprovements: pickAnswer(answers, 'football_improvements'),
  }
}

export function hasAnyTargets(targets: ReviewTargets): boolean {
  return !!(
    targets.agreedTargets ||
    targets.supportNeeds ||
    targets.academicImprovements ||
    targets.footballImprovements
  )
}
