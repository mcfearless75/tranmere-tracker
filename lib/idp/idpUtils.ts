export type IdpStatus = 'active' | 'completed' | 'paused'

export interface IdpPlan {
  id: string
  student_id: string
  title: string
  description: string | null
  target_date: string | null
  status: IdpStatus
  created_at: string
  updated_at: string
}

export function getStatusLabel(status: IdpStatus): string {
  switch (status) {
    case 'active':
      return 'Active'
    case 'completed':
      return 'Completed'
    case 'paused':
      return 'Paused'
  }
}

export function isOverdue(plan: IdpPlan, now: Date = new Date()): boolean {
  if (plan.status !== 'active') return false
  if (!plan.target_date) return false
  const target = new Date(plan.target_date)
  // Compare date only — strip time component
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return target < todayMidnight
}

export function sortPlans(plans: IdpPlan[]): IdpPlan[] {
  return [...plans].sort((a, b) => {
    // Order: active first, then completed, then paused
    const statusOrder: Record<IdpStatus, number> = { active: 0, completed: 1, paused: 2 }
    const statusDiff = statusOrder[a.status] - statusOrder[b.status]
    if (statusDiff !== 0) return statusDiff

    // Within active: sort by target_date asc, nulls last
    if (a.status === 'active') {
      if (!a.target_date && !b.target_date) return 0
      if (!a.target_date) return 1
      if (!b.target_date) return -1
      return a.target_date.localeCompare(b.target_date)
    }

    return 0
  })
}
