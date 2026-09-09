import { render, screen } from '@testing-library/react'
import { WellbeingTrendChart } from '@/components/wellbeing/WellbeingTrendChart'

// Same convention as __tests__/components/charts/AttendanceBar.test.tsx
jest.mock('recharts', () => {
  const actual = jest.requireActual('recharts')
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  }
})

global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

describe('WellbeingTrendChart', () => {
  it('shows an empty-state message with 0 data points', () => {
    render(<WellbeingTrendChart data={[]} />)
    expect(screen.getByText(/complete a couple more check-ins/i)).toBeInTheDocument()
  })

  it('shows an empty-state message with only 1 data point', () => {
    render(<WellbeingTrendChart data={[{ sentAt: '2026-09-01T00:00:00Z', avg: 4 }]} />)
    expect(screen.getByText(/complete a couple more check-ins/i)).toBeInTheDocument()
  })

  it('renders a chart (not the empty state) with 2+ data points', () => {
    render(<WellbeingTrendChart data={[
      { sentAt: '2026-08-25T00:00:00Z', avg: 3.5 },
      { sentAt: '2026-09-01T00:00:00Z', avg: 4.2 },
    ]} />)
    expect(screen.queryByText(/complete a couple more check-ins/i)).not.toBeInTheDocument()
  })
})
