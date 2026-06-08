export type GoalCategory = 'personal' | 'academic' | 'football' | 'fitness'
export type GoalPriority = 'low' | 'medium' | 'high'
export type GoalStatus = 'in_progress' | 'completed' | 'abandoned'

export interface StudentGoal {
  id: string
  student_id: string
  title: string
  description: string | null
  category: GoalCategory
  deadline: string | null
  priority: GoalPriority
  status: GoalStatus
  completed_at: string | null
  created_at: string
  updated_at: string
}

export const PRIORITY_ORDER: Record<GoalPriority, number> = {
  high: 1,
  medium: 2,
  low: 3,
}

/**
 * Returns true if the goal has a deadline that has already passed
 * and the status is still in_progress.
 */
export function isOverdue(goal: StudentGoal): boolean {
  if (!goal.deadline || goal.status !== 'in_progress') return false
  const deadline = new Date(goal.deadline)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return deadline < today
}

/**
 * Returns the number of days until the deadline (negative means overdue).
 * Returns null if no deadline is set.
 */
export function daysUntilDeadline(goal: StudentGoal): number | null {
  if (!goal.deadline) return null
  const deadline = new Date(goal.deadline)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  deadline.setHours(0, 0, 0, 0)
  const diffMs = deadline.getTime() - today.getTime()
  return Math.round(diffMs / (1000 * 60 * 60 * 24))
}

/**
 * Sorts goals: in_progress first (by priority then deadline), completed/abandoned last.
 */
export function sortGoals(goals: StudentGoal[]): StudentGoal[] {
  return [...goals].sort((a, b) => {
    const aActive = a.status === 'in_progress'
    const bActive = b.status === 'in_progress'

    // Active goals before inactive
    if (aActive && !bActive) return -1
    if (!aActive && bActive) return 1

    if (aActive && bActive) {
      // Sort by priority first
      const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
      if (priorityDiff !== 0) return priorityDiff

      // Then by deadline (nulls last)
      if (!a.deadline && !b.deadline) return 0
      if (!a.deadline) return 1
      if (!b.deadline) return -1
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
    }

    return 0
  })
}

/**
 * Returns the percentage of goals that are completed (0–100, rounded).
 */
export function getCompletionRate(goals: StudentGoal[]): number {
  if (goals.length === 0) return 0
  const completed = goals.filter(g => g.status === 'completed').length
  return Math.round((completed / goals.length) * 100)
}
