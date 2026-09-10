import { render, screen, fireEvent } from '@testing-library/react'
import { WellbeingAnswerDetail } from '@/components/wellbeing/WellbeingAnswerDetail'

const FULL_RESPONSES = [
  { question_key: 'mood', score: 4, note: null },
  { question_key: 'sleep', score: 3, note: null },
  { question_key: 'energy', score: 4, note: null },
  { question_key: 'stress', score: 4, note: null },
  { question_key: 'connection', score: 1, note: null },
  { question_key: 'football_enjoyment', score: 5, note: null },
]

describe('WellbeingAnswerDetail', () => {
  it('is collapsed by default, showing only the toggle', () => {
    render(<WellbeingAnswerDetail responses={FULL_RESPONSES} />)
    expect(screen.getByRole('button', { name: /see what they answered/i })).toBeInTheDocument()
    expect(screen.queryByText(/Not at all/i)).not.toBeInTheDocument()
  })

  it('expands to show each question\'s actual answer text, not just the number', () => {
    render(<WellbeingAnswerDetail responses={FULL_RESPONSES} />)
    fireEvent.click(screen.getByRole('button', { name: /see what they answered/i }))

    // stress reads direction-aware ("Very" for a 4), not the generic scale
    expect(screen.getByText(/4 · Very/)).toBeInTheDocument()
    // connection has its own distinct wording too
    expect(screen.getByText(/1 · Not at all/)).toBeInTheDocument()
    // an ordinary generic-scale question
    expect(screen.getByText(/5 · Great/)).toBeInTheDocument()
  })

  it('shows "Not answered" for a question the student skipped', () => {
    const partial = FULL_RESPONSES.filter(r => r.question_key !== 'football_enjoyment')
    render(<WellbeingAnswerDetail responses={partial} />)
    fireEvent.click(screen.getByRole('button', { name: /see what they answered/i }))
    expect(screen.getByText('Not answered')).toBeInTheDocument()
  })

  it('collapses again on a second click', () => {
    render(<WellbeingAnswerDetail responses={FULL_RESPONSES} />)
    const toggle = screen.getByRole('button', { name: /see what they answered/i })
    fireEvent.click(toggle)
    fireEvent.click(screen.getByRole('button', { name: /hide answers/i }))
    expect(screen.queryByText(/4 · Very/)).not.toBeInTheDocument()
  })
})
