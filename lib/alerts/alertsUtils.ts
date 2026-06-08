export interface OverdueAlert {
  studentId: string
  studentName: string
  assignmentTitle: string
  dueDate: string
  daysOverdue: number
}

interface AssignmentRow {
  student_id: string
  student_name: string
  title: string
  due_date: string
  status?: string
}

const SUBMITTED_STATUSES = new Set(['submitted', 'graded'])
const MS_PER_DAY = 1000 * 60 * 60 * 24

export function buildOverdueAlerts(
  assignments: AssignmentRow[],
  now: Date,
): OverdueAlert[] {
  const alerts: OverdueAlert[] = []

  for (const assignment of assignments) {
    if (SUBMITTED_STATUSES.has(assignment.status ?? '')) {
      continue
    }

    const due = new Date(assignment.due_date)
    if (due >= now) {
      continue
    }

    const daysOverdue = Math.floor((now.getTime() - due.getTime()) / MS_PER_DAY)

    alerts.push({
      studentId: assignment.student_id,
      studentName: assignment.student_name,
      assignmentTitle: assignment.title,
      dueDate: assignment.due_date,
      daysOverdue,
    })
  }

  return alerts
}

export function formatAlertMessage(alert: OverdueAlert): string {
  const dayLabel = alert.daysOverdue === 1 ? 'day' : 'days'
  return `${alert.studentName} — "${alert.assignmentTitle}" is ${alert.daysOverdue} ${dayLabel} overdue (due ${alert.dueDate}).`
}
