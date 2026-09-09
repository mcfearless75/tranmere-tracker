/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import WellbeingPage from '@/app/(student)/wellbeing/page'

const STUDENT_ID = 'student-1'

jest.mock('@/components/wellbeing/WellbeingTrendChart', () => ({
  // Stub — this component has its own dedicated test (Task 1). Here we only
  // need to verify the PAGE fetches the right data and passes it through.
  WellbeingTrendChart: ({ data }: { data: unknown }) => (
    <div data-testid="trend-chart">{JSON.stringify(data)}</div>
  ),
}))

const getUserMock = jest.fn(() => Promise.resolve({ data: { user: { id: STUDENT_ID } } }))
const openSurveyMaybeSingleMock = jest.fn(() => Promise.resolve({ data: null })) // no open survey by default
const completedSurveysMock = jest.fn(() => Promise.resolve({ data: [] }))

jest.mock('@supabase/ssr', () => ({
  createBrowserClient: () => ({
    auth: { getUser: getUserMock },
    from: (table: string) => {
      if (table !== 'wellbeing_surveys') throw new Error(`Unexpected table: ${table}`)
      return {
        select: (cols: string) => {
          if (cols === 'id') {
            return {
              eq: () => ({
                eq: () => ({
                  order: () => ({
                    limit: () => ({ maybeSingle: openSurveyMaybeSingleMock }),
                  }),
                }),
              }),
            }
          }
          // completed-surveys trend query
          return {
            eq: () => ({
              eq: () => ({
                order: () => ({
                  limit: completedSurveysMock,
                }),
              }),
            }),
          }
        },
      }
    },
  }),
}))

beforeEach(() => {
  getUserMock.mockClear()
  openSurveyMaybeSingleMock.mockClear()
  completedSurveysMock.mockClear()
})

describe('WellbeingPage — trend tab', () => {
  it('does not fetch completed surveys until the "My Trend" tab is opened', async () => {
    render(<WellbeingPage />)
    await waitFor(() => expect(openSurveyMaybeSingleMock).toHaveBeenCalled())
    expect(completedSurveysMock).not.toHaveBeenCalled()
  })

  it('fetches completed surveys and passes the computed trend to WellbeingTrendChart', async () => {
    completedSurveysMock.mockResolvedValueOnce({
      data: [
        { sent_at: '2026-09-01T00:00:00Z', wellbeing_responses: [{ question_key: 'mood', score: 4 }] },
        { sent_at: '2026-08-25T00:00:00Z', wellbeing_responses: [{ question_key: 'mood', score: 3 }] },
      ],
    })
    render(<WellbeingPage />)
    await waitFor(() => expect(openSurveyMaybeSingleMock).toHaveBeenCalled())
    fireEvent.click(screen.getByText('My Trend'))
    await waitFor(() => expect(completedSurveysMock).toHaveBeenCalledTimes(1))
    const chart = await screen.findByTestId('trend-chart')
    // Oldest-first after buildWellbeingTrend: 25 Aug (score 3) then 01 Sep (score 4)
    expect(chart.textContent).toContain('"avg":3')
    expect(chart.textContent).toContain('"avg":4')
  })

  it('preserves in-progress check-in state when switching tabs away and back', async () => {
    openSurveyMaybeSingleMock.mockResolvedValueOnce({ data: { id: 'survey-1' } })
    render(<WellbeingPage />)
    // Wait for the form to appear (first question) and select a score.
    const scoreButtons = await screen.findAllByRole('button', { name: '5' })
    fireEvent.click(scoreButtons[0])

    fireEvent.click(screen.getByText('My Trend'))
    await screen.findByTestId('trend-chart')
    fireEvent.click(screen.getByText('Check-in'))

    // The previously-selected score for the first question is still selected —
    // proven by the score label rendering, not just the button's own state.
    expect(await screen.findByText('Great')).toBeInTheDocument()
  })
})
