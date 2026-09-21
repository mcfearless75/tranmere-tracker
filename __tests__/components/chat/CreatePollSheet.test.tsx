import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CreatePollSheet } from '@/components/chat/CreatePollSheet'
import { POLL_QUESTION_MAX, POLL_OPTION_MAX, POLL_MAX_OPTIONS } from '@/lib/chat/types'

describe('CreatePollSheet', () => {
  it('caps the question and option fields at their column limits', () => {
    render(<CreatePollSheet onSubmit={jest.fn()} onClose={jest.fn()} />)
    expect(screen.getByLabelText('Question')).toHaveAttribute('maxLength', String(POLL_QUESTION_MAX))
    expect(screen.getByLabelText('Option 1')).toHaveAttribute('maxLength', String(POLL_OPTION_MAX))
  })

  it('shows a character counter for the question', () => {
    render(<CreatePollSheet onSubmit={jest.fn()} onClose={jest.fn()} />)
    fireEvent.change(screen.getByLabelText('Question'), { target: { value: 'Who?' } })
    expect(screen.getByText(`4/${POLL_QUESTION_MAX}`)).toBeInTheDocument()
  })

  it('starts with two option rows and adds more up to the maximum', () => {
    render(<CreatePollSheet onSubmit={jest.fn()} onClose={jest.fn()} />)
    expect(screen.getByLabelText('Option 2')).toBeInTheDocument()
    expect(screen.queryByLabelText('Option 3')).not.toBeInTheDocument()

    for (let i = 3; i <= POLL_MAX_OPTIONS; i++) {
      fireEvent.click(screen.getByText('Add option'))
    }
    expect(screen.getByLabelText(`Option ${POLL_MAX_OPTIONS}`)).toBeInTheDocument()
    expect(screen.queryByText('Add option')).not.toBeInTheDocument()
  })

  it('blocks submission and explains why when input is invalid', async () => {
    const onSubmit = jest.fn()
    render(<CreatePollSheet onSubmit={onSubmit} onClose={jest.fn()} />)
    fireEvent.click(screen.getByText('Post poll'))
    expect(await screen.findByText('Add a question')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits trimmed values and closes on success', async () => {
    const onSubmit = jest.fn(() => Promise.resolve({ ok: true }))
    const onClose = jest.fn()
    render(<CreatePollSheet onSubmit={onSubmit} onClose={onClose} />)
    fireEvent.change(screen.getByLabelText('Question'), { target: { value: '  Who is coming?  ' } })
    fireEvent.change(screen.getByLabelText('Option 1'), { target: { value: ' Yes ' } })
    fireEvent.change(screen.getByLabelText('Option 2'), { target: { value: 'No' } })
    fireEvent.click(screen.getByText('Post poll'))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('Who is coming?', ['Yes', 'No']))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('shows the server error and stays open when submission fails', async () => {
    const onSubmit = jest.fn(() => Promise.resolve({ ok: false, error: 'Only staff can post polls' }))
    const onClose = jest.fn()
    render(<CreatePollSheet onSubmit={onSubmit} onClose={onClose} />)
    fireEvent.change(screen.getByLabelText('Question'), { target: { value: 'Who is coming?' } })
    fireEvent.change(screen.getByLabelText('Option 1'), { target: { value: 'Yes' } })
    fireEvent.change(screen.getByLabelText('Option 2'), { target: { value: 'No' } })
    fireEvent.click(screen.getByText('Post poll'))

    expect(await screen.findByText('Only staff can post polls')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })
})
