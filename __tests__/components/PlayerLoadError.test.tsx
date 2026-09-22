import { render, screen } from '@testing-library/react'
import { PlayerLoadError } from '@/components/PlayerLoadError'

describe('PlayerLoadError', () => {
  it('shows a plain-English, reportable message rather than nothing', () => {
    render(<PlayerLoadError />)
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Could not load players. This usually means the app needs a database update — tell Paul.'
    )
  })
})
