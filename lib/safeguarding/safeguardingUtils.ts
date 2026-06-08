export type ConcernCategory =
  | 'wellbeing'
  | 'behaviour'
  | 'attendance'
  | 'physical'
  | 'online'
  | 'other'

export type ConcernSeverity = 'low' | 'medium' | 'high'

export type ConcernStatus = 'open' | 'monitoring' | 'escalated' | 'closed'

export interface SafeguardingConcern {
  id: string
  student_id: string
  raised_by: string | null
  category: ConcernCategory
  severity: ConcernSeverity
  description: string
  status: ConcernStatus
  created_at: string
  updated_at: string
}

export interface SafeguardingNote {
  id: string
  concern_id: string
  author_id: string | null
  note: string
  created_at: string
}

export const CONCERN_CATEGORIES: ConcernCategory[] = [
  'wellbeing',
  'behaviour',
  'attendance',
  'physical',
  'online',
  'other',
]

export const CONCERN_SEVERITIES: ConcernSeverity[] = ['low', 'medium', 'high']

export const CONCERN_STATUSES: ConcernStatus[] = ['open', 'monitoring', 'escalated', 'closed']

export const CATEGORY_LABELS: Record<ConcernCategory, string> = {
  wellbeing: 'Wellbeing',
  behaviour: 'Behaviour',
  attendance: 'Attendance',
  physical: 'Physical',
  online: 'Online / Digital',
  other: 'Other',
}

export const SEVERITY_LABELS: Record<ConcernSeverity, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
}

export const STATUS_LABELS: Record<ConcernStatus, string> = {
  open: 'Open',
  monitoring: 'Monitoring',
  escalated: 'Escalated',
  closed: 'Closed',
}

/** Tailwind classes for a severity badge. */
export function severityClasses(severity: ConcernSeverity): string {
  switch (severity) {
    case 'high':
      return 'bg-red-100 text-red-700 border-red-200'
    case 'medium':
      return 'bg-amber-100 text-amber-700 border-amber-200'
    case 'low':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200'
  }
}

/** Tailwind classes for a status badge. */
export function statusClasses(status: ConcernStatus): string {
  switch (status) {
    case 'open':
      return 'bg-blue-100 text-blue-700 border-blue-200'
    case 'monitoring':
      return 'bg-amber-100 text-amber-700 border-amber-200'
    case 'escalated':
      return 'bg-red-100 text-red-700 border-red-200'
    case 'closed':
      return 'bg-gray-100 text-gray-600 border-gray-200'
  }
}

/** A concern is "active" while it is not yet closed. */
export function isActiveStatus(status: ConcernStatus): boolean {
  return status !== 'closed'
}

const SEVERITY_ORDER: Record<ConcernSeverity, number> = { high: 0, medium: 1, low: 2 }
const STATUS_ORDER: Record<ConcernStatus, number> = {
  escalated: 0,
  open: 1,
  monitoring: 2,
  closed: 3,
}

/**
 * Sorts concerns for triage: active before closed, then by status urgency,
 * then by severity, then newest first.
 */
export function sortConcerns(concerns: SafeguardingConcern[]): SafeguardingConcern[] {
  return [...concerns].sort((a, b) => {
    const statusDiff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
    if (statusDiff !== 0) return statusDiff

    const severityDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
    if (severityDiff !== 0) return severityDiff

    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
}

export type ConcernFilters = {
  status?: ConcernStatus | 'all'
  severity?: ConcernSeverity | 'all'
}

/** Applies status and severity filters to a list of concerns. */
export function filterConcerns(
  concerns: SafeguardingConcern[],
  filters: ConcernFilters,
): SafeguardingConcern[] {
  return concerns.filter(c => {
    if (filters.status && filters.status !== 'all' && c.status !== filters.status) return false
    if (filters.severity && filters.severity !== 'all' && c.severity !== filters.severity) return false
    return true
  })
}

/** Type guards for validating untrusted request input. */
export function isConcernCategory(value: unknown): value is ConcernCategory {
  return typeof value === 'string' && (CONCERN_CATEGORIES as string[]).includes(value)
}

export function isConcernSeverity(value: unknown): value is ConcernSeverity {
  return typeof value === 'string' && (CONCERN_SEVERITIES as string[]).includes(value)
}

export function isConcernStatus(value: unknown): value is ConcernStatus {
  return typeof value === 'string' && (CONCERN_STATUSES as string[]).includes(value)
}
