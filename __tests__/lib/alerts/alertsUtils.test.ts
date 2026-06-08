import { buildOverdueAlerts, formatAlertMessage, OverdueAlert } from '../../../lib/alerts/alertsUtils'

const NOW = new Date('2026-06-08T08:00:00.000Z')

const baseAssignment = {
  student_id: 'stu-1',
  student_name: 'Alice Smith',
  title: 'Biology Essay',
  due_date: '2026-06-01',
  status: 'pending',
}

describe('buildOverdueAlerts', () => {
  it('returns an alert for an overdue pending assignment', () => {
    const result = buildOverdueAlerts([baseAssignment], NOW)
    expect(result).toHaveLength(1)
    expect(result[0].studentId).toBe('stu-1')
    expect(result[0].studentName).toBe('Alice Smith')
    expect(result[0].assignmentTitle).toBe('Biology Essay')
  })

  it('calculates daysOverdue correctly', () => {
    // due 2026-06-01, now 2026-06-08 => 7 days
    const result = buildOverdueAlerts([baseAssignment], NOW)
    expect(result[0].daysOverdue).toBe(7)
  })

  it('excludes assignments with status "submitted"', () => {
    const assignment = { ...baseAssignment, status: 'submitted' }
    const result = buildOverdueAlerts([assignment], NOW)
    expect(result).toHaveLength(0)
  })

  it('excludes assignments with status "graded"', () => {
    const assignment = { ...baseAssignment, status: 'graded' }
    const result = buildOverdueAlerts([assignment], NOW)
    expect(result).toHaveLength(0)
  })

  it('excludes assignments that are not yet due', () => {
    const assignment = { ...baseAssignment, due_date: '2026-06-10' }
    const result = buildOverdueAlerts([assignment], NOW)
    expect(result).toHaveLength(0)
  })

  it('excludes assignments due exactly at NOW', () => {
    const assignment = { ...baseAssignment, due_date: '2026-06-08T08:00:00.000Z' }
    const result = buildOverdueAlerts([assignment], NOW)
    expect(result).toHaveLength(0)
  })

  it('returns multiple alerts for multiple overdue assignments', () => {
    const second = {
      student_id: 'stu-2',
      student_name: 'Bob Jones',
      title: 'Maths Test',
      due_date: '2026-06-05',
      status: 'pending',
    }
    const result = buildOverdueAlerts([baseAssignment, second], NOW)
    expect(result).toHaveLength(2)
  })

  it('handles missing status field (defaults to not submitted)', () => {
    const { status: _status, ...noStatus } = baseAssignment
    const result = buildOverdueAlerts([noStatus], NOW)
    expect(result).toHaveLength(1)
  })

  it('returns empty array when given empty assignments list', () => {
    const result = buildOverdueAlerts([], NOW)
    expect(result).toHaveLength(0)
  })
})

describe('formatAlertMessage', () => {
  const alert: OverdueAlert = {
    studentId: 'stu-1',
    studentName: 'Alice Smith',
    assignmentTitle: 'Biology Essay',
    dueDate: '2026-06-01',
    daysOverdue: 7,
  }

  it('formats message with plural days correctly', () => {
    const msg = formatAlertMessage(alert)
    expect(msg).toBe('Alice Smith — "Biology Essay" is 7 days overdue (due 2026-06-01).')
  })

  it('formats message with singular day correctly', () => {
    const singleDay: OverdueAlert = { ...alert, daysOverdue: 1 }
    const msg = formatAlertMessage(singleDay)
    expect(msg).toContain('1 day overdue')
    expect(msg).not.toContain('1 days')
  })
})
