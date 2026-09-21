import { render, screen, fireEvent } from '@testing-library/react'
import { ReplyQuote } from '@/components/chat/ReplyQuote'
import type { ReplyParent } from '@/lib/chat/types'

const parent: ReplyParent = {
  id: 'm1',
  sender_id: 'u2',
  body: 'Training moved to 6pm',
  attachment_kind: null,
  deleted_at: null,
}

describe('ReplyQuote', () => {
  it('shows the sender name and an excerpt', () => {
    render(<ReplyQuote parent={parent} senderName="Coach Phil" variant="bubble" />)
    expect(screen.getByText('Coach Phil')).toBeInTheDocument()
    expect(screen.getByText('Training moved to 6pm')).toBeInTheDocument()
  })

  it('shows a deleted stub when the parent was soft-deleted', () => {
    render(
      <ReplyQuote
        parent={{ ...parent, deleted_at: '2026-09-21T18:00:00.000Z' }}
        senderName="Coach Phil"
        variant="bubble"
      />
    )
    expect(screen.getByText('Message deleted')).toBeInTheDocument()
    expect(screen.queryByText('Training moved to 6pm')).not.toBeInTheDocument()
  })

  it('shows a deleted stub when the parent could not be loaded at all', () => {
    render(<ReplyQuote parent={null} senderName="" variant="bubble" />)
    expect(screen.getByText('Message deleted')).toBeInTheDocument()
  })

  it('describes an attachment-only parent instead of showing a blank line', () => {
    render(
      <ReplyQuote
        parent={{ ...parent, body: null, attachment_kind: 'image' }}
        senderName="Coach Phil"
        variant="bubble"
      />
    )
    expect(screen.getByText('Photo')).toBeInTheDocument()
  })

  it('calls onCancel from the composer variant', () => {
    const onCancel = jest.fn()
    render(
      <ReplyQuote parent={parent} senderName="Coach Phil" variant="composer" onCancel={onCancel} />
    )
    fireEvent.click(screen.getByLabelText('Cancel reply'))
    expect(onCancel).toHaveBeenCalled()
  })

  it('is tappable in the bubble variant only when onJump is given', () => {
    const onJump = jest.fn()
    const { rerender } = render(
      <ReplyQuote parent={parent} senderName="Coach Phil" variant="bubble" onJump={onJump} />
    )
    fireEvent.click(screen.getByRole('button', { name: /Coach Phil/ }))
    expect(onJump).toHaveBeenCalled()

    rerender(<ReplyQuote parent={parent} senderName="Coach Phil" variant="bubble" />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
