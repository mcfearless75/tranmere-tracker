import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MissingRowActions } from '@/components/attendance/MissingRowActions'
import { postExcuse, postManualOverride } from '@/lib/attendance/attendanceClient'

const refresh = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
jest.mock('@/lib/attendance/attendanceClient', () => ({
  postExcuse: jest.fn(),
  postManualOverride: jest.fn(),
}))

const mockedPostExcuse = postExcuse as jest.Mock
const mockedPostManualOverride = postManualOverride as jest.Mock

describe('MissingRowActions', () => {
  beforeEach(() => {
    refresh.mockReset()
    mockedPostExcuse.mockReset().mockResolvedValue(undefined)
    mockedPostManualOverride.mockReset().mockResolvedValue(undefined)
    jest.spyOn(window, 'confirm').mockReturnValue(true)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('confirms before excusing, then calls postExcuse for that phase only', async () => {
    render(<MissingRowActions studentId="s1" studentName="Jordan" date="2026-09-17" phase="lunch" />)

    fireEvent.click(screen.getByRole('button', { name: /excuse lunch/i }))

    expect(window.confirm).toHaveBeenCalledWith("Excuse Jordan's lunch today?")
    await waitFor(() => expect(mockedPostExcuse).toHaveBeenCalledWith({
      studentId: 's1',
      date: '2026-09-17',
      action: 'excuse',
      reason: 'other',
      phases: ['lunch'],
    }))
    expect(mockedPostManualOverride).not.toHaveBeenCalled()
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it('does not call the excuse endpoint when the confirm dialog is declined', () => {
    ;(window.confirm as jest.Mock).mockReturnValue(false)
    render(<MissingRowActions studentId="s1" studentName="Jordan" date="2026-09-17" phase="lunch" />)

    fireEvent.click(screen.getByRole('button', { name: /excuse lunch/i }))

    expect(mockedPostExcuse).not.toHaveBeenCalled()
    expect(refresh).not.toHaveBeenCalled()
  })

  it('confirms before marking present, then calls postManualOverride with mark_present for that phase', async () => {
    render(<MissingRowActions studentId="s1" studentName="Jordan" date="2026-09-17" phase="lunch" />)

    fireEvent.click(screen.getByRole('button', { name: /mark present/i }))

    expect(window.confirm).toHaveBeenCalledWith('Mark Jordan present for lunch? This is a staff override.')
    await waitFor(() => expect(mockedPostManualOverride).toHaveBeenCalledWith({
      studentId: 's1',
      date: '2026-09-17',
      phase: 'lunch',
      action: 'mark_present',
    }))
    expect(mockedPostExcuse).not.toHaveBeenCalled()
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it('does not call the override endpoint when the confirm dialog is declined', () => {
    ;(window.confirm as jest.Mock).mockReturnValue(false)
    render(<MissingRowActions studentId="s1" studentName="Jordan" date="2026-09-17" phase="lunch" />)

    fireEvent.click(screen.getByRole('button', { name: /mark present/i }))

    expect(mockedPostManualOverride).not.toHaveBeenCalled()
    expect(refresh).not.toHaveBeenCalled()
  })

  it('shows an inline error and a Retry label when the excuse mutation fails, without vanishing', async () => {
    mockedPostExcuse.mockRejectedValue(new Error('Network error'))
    render(<MissingRowActions studentId="s1" studentName="Jordan" date="2026-09-17" phase="am" />)

    fireEvent.click(screen.getByRole('button', { name: /excuse am/i }))

    expect(await screen.findByText('Network error')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })

  it('disables Mark present while an excuse mutation is still in flight (mutual exclusion)', async () => {
    let resolveExcuse!: () => void
    mockedPostExcuse.mockImplementation(() => new Promise<void>(resolve => { resolveExcuse = resolve }))
    render(<MissingRowActions studentId="s1" studentName="Jordan" date="2026-09-17" phase="lunch" />)

    const [excuseButton, markPresentButton] = screen.getAllByRole('button')
    fireEvent.click(excuseButton)

    // The excuse mutation is still pending — both buttons must be disabled,
    // not just the one that was clicked, so a double-tap or slow network
    // can't fire postManualOverride for the same student/phase/date while
    // postExcuse is still outstanding. (Its label flips to "…" while busy,
    // so assert on the elements directly rather than by accessible name.)
    await waitFor(() => expect(excuseButton).toBeDisabled())
    expect(markPresentButton).toBeDisabled()

    fireEvent.click(markPresentButton)
    expect(mockedPostManualOverride).not.toHaveBeenCalled()

    resolveExcuse()
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it('disables Excuse while a mark-present mutation is still in flight (mutual exclusion)', async () => {
    let resolveOverride!: () => void
    mockedPostManualOverride.mockImplementation(() => new Promise<void>(resolve => { resolveOverride = resolve }))
    render(<MissingRowActions studentId="s1" studentName="Jordan" date="2026-09-17" phase="lunch" />)

    const [excuseButton, markPresentButton] = screen.getAllByRole('button')
    fireEvent.click(markPresentButton)

    await waitFor(() => expect(markPresentButton).toBeDisabled())
    expect(excuseButton).toBeDisabled()

    fireEvent.click(excuseButton)
    expect(mockedPostExcuse).not.toHaveBeenCalled()

    resolveOverride()
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it('uses phase-specific confirm/label text for am and pm', () => {
    const { rerender } = render(<MissingRowActions studentId="s1" studentName="Jordan" date="2026-09-17" phase="am" />)
    expect(screen.getByRole('button', { name: 'Excuse AM' })).toBeInTheDocument()

    rerender(<MissingRowActions studentId="s1" studentName="Jordan" date="2026-09-17" phase="pm" />)
    expect(screen.getByRole('button', { name: 'Excuse PM' })).toBeInTheDocument()
  })
})
