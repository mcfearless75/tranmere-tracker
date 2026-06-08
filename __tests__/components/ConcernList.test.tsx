import { render, screen, fireEvent } from '@testing-library/react'
import { ConcernList, SuggestedConcern } from '@/components/admin/safeguarding/ConcernList'
import { SafeguardingConcern } from '@/lib/safeguarding/safeguardingUtils'

function makeConcern(overrides: Partial<SafeguardingConcern> = {}): SafeguardingConcern {
  return {
    id: 'concern-1',
    student_id: 'student-1',
    raised_by: 'admin-1',
    category: 'wellbeing',
    severity: 'medium',
    description: 'Observed low mood in training',
    status: 'open',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

const studentNames = { 'student-1': 'Alice Smith', 'student-2': 'Bob Jones' }

describe('ConcernList', () => {
  it('renders a concern with the student name and description', () => {
    render(
      <ConcernList
        concerns={[makeConcern()]}
        studentNames={studentNames}
        suggestions={[]}
      />,
    )
    expect(screen.getByText('Alice Smith')).toBeInTheDocument()
    expect(screen.getByText(/Observed low mood/)).toBeInTheDocument()
  })

  it('filters concerns by status', () => {
    render(
      <ConcernList
        concerns={[
          makeConcern({ id: 'open-c', status: 'open', student_id: 'student-1' }),
          makeConcern({ id: 'closed-c', status: 'closed', student_id: 'student-2' }),
        ]}
        studentNames={studentNames}
        suggestions={[]}
      />,
    )

    // Both visible initially
    expect(screen.getByText('Alice Smith')).toBeInTheDocument()
    expect(screen.getByText('Bob Jones')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Filter by status'), { target: { value: 'closed' } })

    expect(screen.queryByText('Alice Smith')).not.toBeInTheDocument()
    expect(screen.getByText('Bob Jones')).toBeInTheDocument()
  })

  it('surfaces a suggested concern when the student has no active concern', () => {
    const suggestions: SuggestedConcern[] = [
      { studentId: 'student-9', studentName: 'Charlie Doe', reason: 'Low wellbeing: mood (1/5)' },
    ]
    render(
      <ConcernList concerns={[]} studentNames={{}} suggestions={suggestions} />,
    )
    expect(screen.getByText('Charlie Doe')).toBeInTheDocument()
    expect(screen.getByText(/Low wellbeing/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /raise concern/i })).toHaveAttribute(
      'href',
      expect.stringContaining('student-9'),
    )
  })

  it('hides a suggestion when the student already has an active concern', () => {
    const suggestions: SuggestedConcern[] = [
      { studentId: 'student-1', studentName: 'Alice Smith', reason: 'Low wellbeing: mood (1/5)' },
    ]
    render(
      <ConcernList
        concerns={[makeConcern({ status: 'open', student_id: 'student-1' })]}
        studentNames={studentNames}
        suggestions={suggestions}
      />,
    )
    expect(screen.queryByText(/suggested concerns/i)).not.toBeInTheDocument()
  })

  it('shows an empty state when no concerns match', () => {
    render(<ConcernList concerns={[]} studentNames={{}} suggestions={[]} />)
    expect(screen.getByText(/no concerns match/i)).toBeInTheDocument()
  })
})
