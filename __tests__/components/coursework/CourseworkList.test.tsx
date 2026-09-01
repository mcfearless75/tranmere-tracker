import { render, screen } from '@testing-library/react'
import { CourseworkList } from '@/components/coursework/CourseworkList'
import type { GroupedUnit } from '@/lib/coursework/courseworkUtils'

const groups: GroupedUnit[] = [
  {
    unit: { id: 'u1', course_id: 'c1', unit_number: 'U04', unit_name: 'Sports Leadership' },
    assignments: [
      {
        id: 'a1', unit_id: 'u1', title: 'Leadership Portfolio', description: null,
        due_date: '2026-10-15', grade_target: 'merit', grade: 'distinction',
      },
      {
        id: 'a2', unit_id: 'u1', title: 'Leadership Reflection', description: null,
        due_date: '2026-11-01', grade_target: 'pass', grade: null,
      },
    ],
  },
]

describe('CourseworkList', () => {
  it('renders the unit heading and each assignment title', () => {
    render(<CourseworkList groups={groups} />)

    expect(screen.getByText('U04 · Sports Leadership')).toBeInTheDocument()
    expect(screen.getByText('Leadership Portfolio')).toBeInTheDocument()
    expect(screen.getByText('Leadership Reflection')).toBeInTheDocument()
  })

  it('shows the achieved grade badge when graded', () => {
    render(<CourseworkList groups={groups} />)

    expect(screen.getByText('Distinction')).toBeInTheDocument()
  })

  it('shows "Awaiting result" when not yet graded', () => {
    render(<CourseworkList groups={groups} />)

    expect(screen.getByText('Awaiting result')).toBeInTheDocument()
  })

  it('renders a fallback message when there is no coursework', () => {
    render(<CourseworkList groups={[]} />)

    expect(screen.getByText('No coursework set yet.')).toBeInTheDocument()
  })
})
