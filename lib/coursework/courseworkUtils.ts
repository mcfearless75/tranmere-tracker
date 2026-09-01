// Pure helpers for coursework grade tracking — dependency-free, so grouping
// and label logic is unit-testable without touching Supabase.

export type CourseworkGrade = 'pass' | 'merit' | 'distinction' | 'not_yet_achieved'

export const VALID_COURSEWORK_GRADES: CourseworkGrade[] = [
  'pass',
  'merit',
  'distinction',
  'not_yet_achieved',
]

export const GRADE_LABELS: Record<CourseworkGrade, string> = {
  pass: 'Pass',
  merit: 'Merit',
  distinction: 'Distinction',
  not_yet_achieved: 'Not yet achieved',
}

export const GRADE_COLOURS: Record<CourseworkGrade, string> = {
  pass: 'bg-gray-100 text-gray-800 border-gray-300',
  merit: 'bg-blue-100 text-blue-800 border-blue-200',
  distinction: 'bg-green-100 text-green-800 border-green-200',
  not_yet_achieved: 'bg-amber-100 text-amber-800 border-amber-200',
}

export type BtecUnitRow = {
  id: string
  course_id: string
  unit_number: string
  unit_name: string
}

export type AssignmentRow = {
  id: string
  unit_id: string
  title: string
  description: string | null
  due_date: string
  grade_target: string | null
}

export type AssignmentWithGrade = AssignmentRow & { grade: CourseworkGrade | null }

export type GroupedUnit = {
  unit: BtecUnitRow
  assignments: AssignmentWithGrade[]
}

/**
 * Groups assignments under their BTEC unit, sorted by due date within each
 * unit. Units with no assignments are dropped — nothing useful to show a
 * student/parent. (The admin manager shows every unit including empty
 * ones, so it does its own filtering rather than using this helper.)
 */
export function groupAssignmentsByUnit(
  assignments: AssignmentWithGrade[],
  units: BtecUnitRow[],
): GroupedUnit[] {
  return units
    .map(unit => ({
      unit,
      assignments: assignments
        .filter(a => a.unit_id === unit.id)
        .slice()
        .sort((a, b) => a.due_date.localeCompare(b.due_date)),
    }))
    .filter(group => group.assignments.length > 0)
}
