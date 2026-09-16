import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AdminActions } from '@/app/(admin)/admin/students/[id]/AdminActions'

/**
 * Resetting a student's PIN calls Supabase's admin.auth.admin.updateUserById
 * (app/api/admin/reset-pin), which — per GoTrue's own session model,
 * documented in docs/deep-dive-2026-09-10.md — signs that account out on
 * every device, not just the one the admin is looking at. That surfaced
 * live as "the PIN change broke login" when it fired silently. resetPin()
 * now confirms this up front and repeats it in the success message.
 */
const pushMock = jest.fn()
const refreshMock = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: pushMock, refresh: refreshMock }) }))

let confirmSpy: jest.SpyInstance
const fetchMock = jest.fn()

beforeEach(() => {
  confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true)
  fetchMock.mockReset()
  fetchMock.mockResolvedValue({
    json: () => Promise.resolve({ success: true, message: 'PIN reset. They can now sign in with PIN 12345.' }),
  })
  ;(global as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch
})

afterEach(() => {
  confirmSpy.mockRestore()
})

function fillPin(pin: string) {
  fireEvent.change(screen.getByPlaceholderText(/new pin/i), { target: { value: pin } })
}

describe('AdminActions — reset PIN sign-out warning', () => {
  it('confirms before submitting, naming the sign-out-everywhere consequence', async () => {
    render(<AdminActions userId="student-1" userName="Alfie Casey" email="alfie@example.com" />)
    fillPin('194756')
    fireEvent.click(screen.getByRole('button', { name: /^reset$/i }))

    expect(confirmSpy).toHaveBeenCalledWith(expect.stringMatching(/signs them out on every phone and browser/i))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/admin/reset-pin', expect.objectContaining({ method: 'POST' })))
  })

  it('does not call the API when the admin declines the confirmation', async () => {
    confirmSpy.mockReturnValue(false)
    render(<AdminActions userId="student-1" userName="Alfie Casey" email="alfie@example.com" />)
    fillPin('194756')
    fireEvent.click(screen.getByRole('button', { name: /^reset$/i }))

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('repeats the sign-out warning alongside the success message', async () => {
    render(<AdminActions userId="student-1" userName="Alfie Casey" email="alfie@example.com" />)
    fillPin('194756')
    fireEvent.click(screen.getByRole('button', { name: /^reset$/i }))

    expect(await screen.findByText(/signed them out on every phone and browser/i)).toBeInTheDocument()
  })
})
