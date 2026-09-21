import { render, screen } from '@testing-library/react'
import { MessageBody } from '@/components/chat/MessageBody'

describe('MessageBody', () => {
  it('renders a plain message as text with no links', () => {
    const { container } = render(<MessageBody body="training at 6pm" mine={false} />)
    expect(screen.getByText(/training at 6pm/)).toBeInTheDocument()
    expect(container.querySelector('a')).toBeNull()
  })

  it('renders a pasted URL as a clickable link that opens safely in a new tab', () => {
    render(<MessageBody body="tracker: https://example.com/sheet.xlsx" mine={false} />)
    const link = screen.getByRole('link', { name: 'https://example.com/sheet.xlsx' })
    expect(link).toHaveAttribute('href', 'https://example.com/sheet.xlsx')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('upgrades a bare www. link to https', () => {
    render(<MessageBody body="www.example.com" mine={false} />)
    expect(screen.getByRole('link', { name: 'www.example.com' })).toHaveAttribute(
      'href',
      'https://www.example.com',
    )
  })

  it('uses a readable link colour on your own blue bubble', () => {
    render(<MessageBody body="https://example.com" mine={true} />)
    expect(screen.getByRole('link', { name: 'https://example.com' })).toHaveClass('text-white')
  })

  it('never renders a javascript: payload as a link', () => {
    // eslint-disable-next-line no-script-url
    const { container } = render(<MessageBody body="javascript:alert(1)" mine={false} />)
    expect(container.querySelector('a')).toBeNull()
  })
})
