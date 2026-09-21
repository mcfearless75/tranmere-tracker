import { render, screen, fireEvent } from '@testing-library/react'
import { ReplyQuote } from '@/components/chat/ReplyQuote'
import type { ReplyParent } from '@/lib/chat/types'

const parent: ReplyParent = {
  id: 'm1',
  sender_id: 'u2',
  body: 'Training moved to 6pm',
  attachment_kind: null,
  deleted_at: null,
  poll_id: null,
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

  it('falls back to the deleted stub for a parent with neither body nor attachment', () => {
    render(
      <ReplyQuote
        parent={{ ...parent, body: null, attachment_kind: null }}
        senderName="Coach Phil"
        variant="bubble"
      />
    )
    expect(screen.getByText('Message deleted')).toBeInTheDocument()
  })

  // A poll carrier message has body === null AND attachment_kind === null,
  // which is byte-identical to a message with nothing left to show. Without
  // the poll_id branch, replying to a live open poll quoted it as deleted.
  it('describes a poll parent as "Poll", not as a deleted message', () => {
    render(
      <ReplyQuote
        parent={{ ...parent, body: null, attachment_kind: null, poll_id: 'poll-1' }}
        senderName="Coach Phil"
        variant="bubble"
      />
    )
    expect(screen.getByText('Poll')).toBeInTheDocument()
    expect(screen.queryByText('Message deleted')).not.toBeInTheDocument()
  })

  it('still shows the deleted stub for a soft-deleted poll parent', () => {
    render(
      <ReplyQuote
        parent={{ ...parent, body: null, attachment_kind: null, poll_id: 'poll-1', deleted_at: '2026-09-21T18:00:00.000Z' }}
        senderName="Coach Phil"
        variant="bubble"
      />
    )
    expect(screen.getByText('Message deleted')).toBeInTheDocument()
  })

  it('falls back to the deleted stub for a parent with only whitespace in body', () => {
    render(
      <ReplyQuote
        parent={{ ...parent, body: '   ', attachment_kind: null }}
        senderName="Coach Phil"
        variant="bubble"
      />
    )
    expect(screen.getByText('Message deleted')).toBeInTheDocument()
  })
})
