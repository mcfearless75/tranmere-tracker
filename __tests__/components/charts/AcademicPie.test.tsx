import { render, screen } from '@testing-library/react'
import { AcademicPie } from '@/components/charts/AcademicPie'
import type { AcademicCounts } from '@/lib/charts/academicUtils'

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

describe('AcademicPie', () => {
  it('renders without crashing when data has values', () => {
    const data: AcademicCounts = { complete: 4, inProgress: 2, notStarted: 1 }
    const { container } = render(
      <AcademicPie data={data} onSliceClick={jest.fn()} />
    )
    expect(container).toBeTruthy()
  })

  it('shows "No academic data" when all counts are zero', () => {
    const data: AcademicCounts = { complete: 0, inProgress: 0, notStarted: 0 }
    render(<AcademicPie data={data} onSliceClick={jest.fn()} />)
    expect(screen.getByText(/no academic data/i)).toBeInTheDocument()
  })

  it('renders legend labels when data is present', () => {
    const data: AcademicCounts = { complete: 3, inProgress: 1, notStarted: 2 }
    render(<AcademicPie data={data} onSliceClick={jest.fn()} />)
    expect(screen.getByText(/complete/i)).toBeInTheDocument()
    expect(screen.getByText(/in progress/i)).toBeInTheDocument()
    expect(screen.getByText(/not started/i)).toBeInTheDocument()
  })

  it('renders count values in legend', () => {
    const data: AcademicCounts = { complete: 5, inProgress: 2, notStarted: 1 }
    render(<AcademicPie data={data} onSliceClick={jest.fn()} />)
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
  })
})
