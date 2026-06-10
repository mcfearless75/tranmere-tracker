import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { TrialApplicationForm } from '@/components/recruitment/TrialApplicationForm'

/** Date of birth ~15 years ago, always inside the 10-21 eligibility window. */
function eligibleDob(): string {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 15)
  return d.toISOString().split('T')[0]
}

function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Jamie' } })
  fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Carragher' } })
  fireEvent.change(screen.getByLabelText(/date of birth/i), { target: { value: eligibleDob() } })
  fireEvent.change(screen.getByLabelText(/contact email/i), {
    target: { value: 'parent@example.com' },
  })
  fireEvent.change(screen.getByLabelText(/parent\/guardian name/i), {
    target: { value: 'Pat Carragher' },
  })
}

describe('TrialApplicationForm', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    }) as unknown as typeof fetch
  })

  it('renders the application fields including the consent checkbox', () => {
    render(<TrialApplicationForm />)
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/date of birth/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/contact email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/parent\/guardian name/i)).toBeInTheDocument()
    expect(screen.getByRole('checkbox')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /submit application/i })).toBeInTheDocument()
  })

  it('hides the honeypot field from real users', () => {
    const { container } = render(<TrialApplicationForm />)
    const honeypot = container.querySelector('input[name="website"]') as HTMLInputElement
    expect(honeypot).toBeInTheDocument()
    expect(honeypot.tabIndex).toBe(-1)
    expect(honeypot.closest('[aria-hidden="true"]')).not.toBeNull()
  })

  it('blocks submission and shows an error when consent is not given', async () => {
    render(<TrialApplicationForm />)
    fillRequiredFields()
    // Consent checkbox deliberately left unticked
    fireEvent.click(screen.getByRole('button', { name: /submit application/i }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/consent is required/i)
    )
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('posts a valid application and shows the success message', async () => {
    render(<TrialApplicationForm />)
    fillRequiredFields()
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /submit application/i }))

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0]
    expect(url).toBe('/api/recruitment/apply')
    const body = JSON.parse(init.body)
    expect(body.first_name).toBe('Jamie')
    expect(body.parent_guardian_name).toBe('Pat Carragher')
    expect(body.consent_given).toBe(true)
    expect(body.website).toBe('')

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(/application received/i)
    )
  })

  it('shows the server error message when the API rejects the application', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'A valid contact email is required' }),
    }) as unknown as typeof fetch

    render(<TrialApplicationForm />)
    fillRequiredFields()
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /submit application/i }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/valid contact email/i)
    )
  })
})
