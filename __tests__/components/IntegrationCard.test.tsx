import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { IntegrationCard } from '@/components/admin/integrations/IntegrationCard'
import type { ClientIntegration } from '@/lib/integrations/clientView'

const moodle: ClientIntegration = {
  provider: 'moodle',
  name: 'Moodle (REST)',
  description: 'Pull grades and course data.',
  enabled: false,
  usesBaseUrl: true,
  baseUrlLabel: 'Moodle site URL',
  baseUrlPlaceholder: 'https://moodle.test',
  baseUrl: '',
  fields: [{ key: 'token', label: 'Web Services Token', secret: true, value: '', hasValue: false }],
}

describe('IntegrationCard', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('renders the provider name and description', () => {
    render(<IntegrationCard integration={moodle} />)
    expect(screen.getByText('Moodle (REST)')).toBeInTheDocument()
    expect(screen.getByText(/pull grades/i)).toBeInTheDocument()
  })

  it('renders an enable toggle and base URL field', () => {
    render(<IntegrationCard integration={moodle} />)
    expect(screen.getByLabelText(/enable moodle/i)).toBeInTheDocument()
    expect(screen.getByText('Moodle site URL')).toBeInTheDocument()
  })

  it('runs a test connection and shows the adapter message', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, result: { ok: false, message: 'Not configured — add credentials and enable to connect.' } }),
    } as Response)

    render(<IntegrationCard integration={moodle} />)
    fireEvent.click(screen.getByRole('button', { name: /test connection/i }))

    await waitFor(() => {
      expect(screen.getByText(/not configured/i)).toBeInTheDocument()
    })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/integrations/test',
      expect.objectContaining({ method: 'POST' }),
    )
  })
})
