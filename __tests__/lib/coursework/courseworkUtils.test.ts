import {
  groupAssignmentsByUnit,
  GRADE_LABELS,
  GRADE_COLOURS,
  VALID_COURSEWORK_GRADES,
  type BtecUnitRow,
  type AssignmentWithGrade,
} from '@/lib/coursework/courseworkUtils'

const units: BtecUnitRow[] = [
  { id: 'u1', course_id: 'c1', unit_number: 'U01', unit_name: 'Anatomy and Physiology' },
  { id: 'u2', course_id: 'c1', unit_number: 'U04', unit_name: 'Sports Leadership' },
  { id: 'u3', course_id: 'c1', unit_number: 'U08', unit_name: 'Coaching for Performance' },
]

function assignment(overrides: Partial<AssignmentWithGrade>): AssignmentWithGrade {
  return {
    id: 'a1',
    unit_id: 'u1',
    title: 'Assignment 1',
    description: null,
    due_date: '2026-10-01',
    grade_target: 'merit',
    grade: null,
    ...overrides,
  }
}

describe('groupAssignmentsByUnit', () => {
  it('groups assignments under their unit', () => {
    const assignments = [
      assignment({ id: 'a1', unit_id: 'u1', due_date: '2026-10-01' }),
      assignment({ id: 'a2', unit_id: 'u2', due_date: '2026-10-05' }),
    ]

    const result = groupAssignmentsByUnit(assignments, units)

    expect(result).toHaveLength(2)
    expect(result[0].unit.id).toBe('u1')
    expect(result[0].assignments).toHaveLength(1)
    expect(result[0].assignments[0].id).toBe('a1')
    expect(result[1].unit.id).toBe('u2')
  })

  it('sorts assignments within a unit by due date ascending', () => {
    const assignments = [
      assignment({ id: 'later', unit_id: 'u1', due_date: '2026-11-01' }),
      assignment({ id: 'earlier', unit_id: 'u1', due_date: '2026-10-01' }),
    ]

    const result = groupAssignmentsByUnit(assignments, units)

    expect(result[0].assignments.map(a => a.id)).toEqual(['earlier', 'later'])
  })

  it('drops units with no assignments', () => {
    const assignments = [assignment({ id: 'a1', unit_id: 'u1' })]

    const result = groupAssignmentsByUnit(assignments, units)

    expect(result).toHaveLength(1)
    expect(result[0].unit.id).toBe('u1')
  })

  it('returns an empty array when no assignments exist', () => {
    expect(groupAssignmentsByUnit([], units)).toEqual([])
  })
})

describe('GRADE_LABELS / GRADE_COLOURS / VALID_COURSEWORK_GRADES', () => {
  it('has a label and colour for every valid grade', () => {
    for (const grade of VALID_COURSEWORK_GRADES) {
      expect(GRADE_LABELS[grade]).toBeTruthy()
      expect(GRADE_COLOURS[grade]).toBeTruthy()
    }
  })

  it('exposes exactly the 4 BTEC outcome values', () => {
    expect(VALID_COURSEWORK_GRADES).toEqual(['pass', 'merit', 'distinction', 'not_yet_achieved'])
  })
})
