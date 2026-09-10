import { render, screen } from '@testing-library/react'
import { CompleteProfilePromptCard } from '@/components/account/CompleteProfilePromptCard'

describe('CompleteProfilePromptCard', () => {
  it('shows the nudge and a link to the profile page', () => {
    render(<CompleteProfilePromptCard />)
    expect(screen.getByText(/finish setting up your profile/i)).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /complete my profile/i })
    expect(link).toHaveAttribute('href', '/profile')
  })
})
