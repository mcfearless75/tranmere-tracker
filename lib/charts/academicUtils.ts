export type Submission = {
  assignment_id: string
  status: 'not_started' | 'in_progress' | 'submitted' | 'graded'
}

export type AcademicCounts = {
  complete: number    // submitted + graded
  inProgress: number  // in_progress
  notStarted: number  // not_started
}

export function buildAcademicCounts(submissions: Submission[]): AcademicCounts {
  let complete = 0
  let inProgress = 0
  let notStarted = 0

  for (const s of submissions) {
    if (s.status === 'submitted' || s.status === 'graded') complete++
    else if (s.status === 'in_progress') inProgress++
    else if (s.status === 'not_started') notStarted++
  }

  return { complete, inProgress, notStarted }
}
