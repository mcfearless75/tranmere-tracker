import { render, screen, fireEvent } from '@testing-library/react'
import { MessageBubble } from '@/components/chat/MessageBubble'
import type { ChatMessage } from '@/lib/chat/types'

const baseMessage: ChatMessage = {
  id: 'm1',
  sender_id: 'u2',
  body: 'Training moved to 6pm',
  attachment_url: null,
  attachment_kind: null,
  created_at: '2026-09-21T17:00:00.000Z',
  reply_to_id: null,
  poll_id: null,
}

function renderBubble(overrides: Partial<React.ComponentProps<typeof MessageBubble>> = {}) {
  const props = {
    message: baseMessage,
    mine: false,
    isBot: false,
    showAvatar: true,
    senderName: 'Coach Phil',
    avatarUrl: null,
    chips: [],
    attachmentSrc: (url: string) => url,
    onOpenSheet: jest.fn(),
    onToggleReaction: jest.fn(),
    ...overrides,
  }
  render(<MessageBubble {...props} />)
  return props
}

describe('MessageBubble', () => {
  it('renders the body and the sender name when the avatar is shown', () => {
    renderBubble()
    expect(screen.getByText('Training moved to 6pm')).toBeInTheDocument()
    expect(screen.getByText('Coach Phil')).toBeInTheDocument()
  })

  it('hides the sender name on a follow-up message from the same sender', () => {
    renderBubble({ showAvatar: false })
    expect(screen.queryByText('Coach Phil')).not.toBeInTheDocument()
  })

  it('labels a bot message as AI Coach', () => {
    renderBubble({ isBot: true })
    expect(screen.getByText('AI Coach')).toBeInTheDocument()
  })

  it('opens the sheet from the react button', () => {
    const props = renderBubble()
    fireEvent.click(screen.getByLabelText('React to message'))
    expect(props.onOpenSheet).toHaveBeenCalledWith('m1')
  })

  it('renders reaction chips and toggles one when tapped', () => {
    const props = renderBubble({ chips: [{ emoji: '👍', count: 3, mine: true }] })
    fireEvent.click(screen.getByText('👍 3'))
    expect(props.onToggleReaction).toHaveBeenCalledWith('m1', '👍')
  })

  it('renders a file attachment as a download link', () => {
    renderBubble({
      message: { ...baseMessage, attachment_kind: 'file', attachment_url: 'u2/plan.pdf' },
    })
    expect(screen.getByRole('link', { name: /plan\.pdf/ })).toBeInTheDocument()
  })
})
