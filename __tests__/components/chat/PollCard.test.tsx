import { render, screen, fireEvent } from '@testing-library/react'
import { PollCard } from '@/components/chat/PollCard'
import type { Poll, PollOption } from '@/lib/chat/types'

const poll: Poll = {
  id: 'poll-1', room_id: 'room-1', created_by: 'staff-1',
  question: 'Who is coming Saturday?', closed_at: null,
  created_at: '2026-09-21T17:00:00.000Z',
}

const options: PollOption[] = [
  { id: 'o1', poll_id: 'poll-1', label: 'Yes', position: 0, vote_count: 3 },
  { id: 'o2', poll_id: 'poll-1', label: 'No', position: 1, vote_count: 1 },
]

function renderCard(overrides: Partial<React.ComponentProps<typeof PollCard>> = {}) {
  const props = {
    poll, options, myOptionId: null, isChatStaff: false,
    onVote: jest.fn(), onClose: jest.fn(),
    ...overrides,
  }
  render(<PollCard {...props} />)
  return props
}

describe('PollCard', () => {
  it('renders the question, the options and the total', () => {
    renderCard()
    expect(screen.getByText('Who is coming Saturday?')).toBeInTheDocument()
    expect(screen.getByText('Yes')).toBeInTheDocument()
    expect(screen.getByText('4 votes')).toBeInTheDocument()
  })

  it('says "1 vote" rather than "1 votes"', () => {
    renderCard({ options: [{ ...options[0], vote_count: 1 }, { ...options[1], vote_count: 0 }] })
    expect(screen.getByText('1 vote')).toBeInTheDocument()
  })

  it('votes when an option is tapped', () => {
    const props = renderCard()
    fireEvent.click(screen.getByRole('button', { name: /Yes/ }))
    expect(props.onVote).toHaveBeenCalledWith('o1')
  })

  it('marks your current choice', () => {
    renderCard({ myOptionId: 'o2' })
    expect(screen.getByRole('button', { name: /No/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /Yes/ })).toHaveAttribute('aria-pressed', 'false')
  })

  it('disables voting and says so once the poll is closed', () => {
    const props = renderCard({ poll: { ...poll, closed_at: '2026-09-21T18:00:00.000Z' } })
    expect(screen.getByText('Poll closed')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Yes/ }))
    expect(props.onVote).not.toHaveBeenCalled()
  })

  it('shows Close to staff only, and only while the poll is open', () => {
    const { unmount } = render(
      <PollCard {...{ poll, options, myOptionId: null, isChatStaff: false, onVote: jest.fn(), onClose: jest.fn() }} />
    )
    expect(screen.queryByText('Close poll')).not.toBeInTheDocument()
    unmount()

    renderCard({ isChatStaff: true })
    expect(screen.getByText('Close poll')).toBeInTheDocument()
  })

  it('offers the voter list to staff and not to students', () => {
    const { unmount } = render(
      <PollCard {...{ poll, options, myOptionId: null, isChatStaff: false, onVote: jest.fn(), onClose: jest.fn(), onShowVoters: jest.fn() }} />
    )
    expect(screen.queryByText('See who voted')).not.toBeInTheDocument()
    unmount()

    renderCard({ isChatStaff: true, onShowVoters: jest.fn() })
    expect(screen.getByText('See who voted')).toBeInTheDocument()
  })

  it('lists voter names grouped by option when staff have loaded them', () => {
    renderCard({
      isChatStaff: true,
      voters: [
        { userId: 'u1', name: 'Alfie', optionId: 'o1' },
        { userId: 'u2', name: 'Bea', optionId: 'o1' },
        { userId: 'u3', name: 'Cal', optionId: 'o2' },
      ],
    })
    expect(screen.getByText('Alfie, Bea')).toBeInTheDocument()
    expect(screen.getByText('Cal')).toBeInTheDocument()
  })

  it('renders zero-vote options without dividing by zero', () => {
    renderCard({ options: options.map(o => ({ ...o, vote_count: 0 })) })
    expect(screen.getByText('No votes yet')).toBeInTheDocument()
  })
})
