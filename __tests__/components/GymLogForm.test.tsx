import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { GymLogForm } from '@/components/gym/GymLogForm'

describe('GymLogForm', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    }) as unknown as typeof fetch
  })

  it('renders a date input defaulting to today', () => {
    const { container } = render(<GymLogForm onLogged={() => {}} />)
    const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement
    expect(dateInput).toBeInTheDocument()
    expect(dateInput.value).toBe(new Date().toISOString().split('T')[0])
  })

  it('posts the chosen date as logged_date so lifts can be backdated', async () => {
    const onLogged = jest.fn()
    const { container } = render(<GymLogForm onLogged={onLogged} />)

    // Pick the first real exercise (index 0 is the placeholder)
    const select = container.querySelector('select') as HTMLSelectElement
    fireEvent.change(select, { target: { value: select.options[1].value } })

    const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement
    fireEvent.change(dateInput, { target: { value: '2026-06-01' } })

    fireEvent.click(screen.getByRole('button', { name: /save lift/i }))

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
    const call = (global.fetch as jest.Mock).mock.calls[0]
    expect(call[0]).toBe('/api/gym/log')
    const body = JSON.parse(call[1].body)
    expect(body.logged_date).toBe('2026-06-01')
    expect(body.exercise).toBeTruthy()
    await waitFor(() => expect(onLogged).toHaveBeenCalled())
  })
})
