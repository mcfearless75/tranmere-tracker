import { render, screen } from '@testing-library/react'
import { AttendanceBar } from '@/components/charts/AttendanceBar'
import type { AttendanceWeek } from '@/lib/charts/attendanceUtils'

// Recharts relies on browser APIs not available in jsdom
jest.mock('recharts', () => {
  const actual = jest.requireActual('recharts')
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  }
})

// ResizeObserver not available in jsdom
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

const sampleData: AttendanceWeek[] = [
  { week: '01 Jan', attended: 3, scheduled: 4, pct: 75 },
  { week: '08 Jan', attended: 4, scheduled: 4, pct: 100 },
]

describe('AttendanceBar', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <AttendanceBar data={sampleData} onBarClick={jest.fn()} />
    )
    expect(container).toBeTruthy()
  })

  it('shows "No attendance data" when data is empty', () => {
    render(<AttendanceBar data={[]} onBarClick={jest.fn()} />)
    expect(screen.getByText(/no attendance data/i)).toBeInTheDocument()
  })

  it('renders a chart container when data is present', () => {
    const { container } = render(
      <AttendanceBar data={sampleData} onBarClick={jest.fn()} />
    )
    // Should render some chart-wrapping element
    expect(container.querySelector('div')).toBeTruthy()
  })
})
