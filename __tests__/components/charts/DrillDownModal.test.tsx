import { render, screen, fireEvent } from '@testing-library/react'
import { DrillDownModal } from '@/components/charts/DrillDownModal'

describe('DrillDownModal', () => {
  const onClose = jest.fn()

  beforeEach(() => {
    onClose.mockClear()
  })

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <DrillDownModal isOpen={false} onClose={onClose} title="Test">
        <p>content</p>
      </DrillDownModal>
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders title when isOpen is true', () => {
    render(
      <DrillDownModal isOpen={true} onClose={onClose} title="Attendance Detail">
        <p>detail content</p>
      </DrillDownModal>
    )
    expect(screen.getByText('Attendance Detail')).toBeInTheDocument()
  })

  it('renders children when open', () => {
    render(
      <DrillDownModal isOpen={true} onClose={onClose} title="Test">
        <p>drill-down body</p>
      </DrillDownModal>
    )
    expect(screen.getByText('drill-down body')).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', () => {
    render(
      <DrillDownModal isOpen={true} onClose={onClose} title="Test">
        <p>content</p>
      </DrillDownModal>
    )
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when backdrop is clicked', () => {
    render(
      <DrillDownModal isOpen={true} onClose={onClose} title="Test">
        <p>content</p>
      </DrillDownModal>
    )
    fireEvent.click(screen.getByTestId('modal-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not call onClose when clicking modal content', () => {
    render(
      <DrillDownModal isOpen={true} onClose={onClose} title="Test">
        <p>content</p>
      </DrillDownModal>
    )
    fireEvent.click(screen.getByTestId('modal-content'))
    expect(onClose).not.toHaveBeenCalled()
  })
})
