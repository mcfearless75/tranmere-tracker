import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { GeoDiagnostic, GeoFix } from '@/lib/attendance/getGeoFix'

const mockRefresh = jest.fn()
const mockPush = jest.fn()
const mockReplace = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh, push: mockPush, replace: mockReplace }),
}))

const mockGetGeoFix = jest.fn()
jest.mock('@/lib/attendance/getGeoFix', () => ({
  getGeoFix: (opts: { onDiagnostic?: (d: GeoDiagnostic) => void }) => mockGetGeoFix(opts),
}))

jest.mock('@/lib/reportClientError', () => ({ reportClientError: jest.fn() }))

import { InAppCheckIn } from '@/app/(student)/attendance/InAppCheckIn'

const QUEUE_KEY = 'checkin_queue_v1'

function queueLength(): number {
  const raw = localStorage.getItem(QUEUE_KEY)
  return raw ? JSON.parse(raw).length : 0
}

function todayLondon(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date())
}

function seedQueuedAm() {
  localStorage.setItem(
    QUEUE_KEY,
    JSON.stringify([
      { phase: 'am', lat: 1, lng: 2, accuracy: 10, recordedAt: '2026-09-17T08:00:00Z', londonDate: todayLondon() },
    ]),
  )
}

function geoOk(fix: GeoFix = { lat: 53.4209, lng: -3.0867, accuracy: 12 }) {
  mockGetGeoFix.mockImplementation(async (opts: { onDiagnostic?: (d: GeoDiagnostic) => void }) => {
    opts.onDiagnostic?.({ highAccuracy: 'success' })
    return fix
  })
}

const fetchMock = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  localStorage.clear()
  global.fetch = fetchMock as unknown as typeof fetch
  geoOk()
})

afterEach(() => {
  localStorage.clear()
})

describe('InAppCheckIn — offline queue', () => {
  it('queues the attempt on a thrown fetch (network down) and switches to the "saved on this phone" message', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    render(<InAppCheckIn phase="am" onSuccess={jest.fn()} />)

    fireEvent.click(await screen.findByText('Morning Check-in'))

    expect(await screen.findByTestId('checkin-queued')).toBeInTheDocument()
    expect(screen.getByText(/Check-in saved on this phone/)).toBeInTheDocument()
    expect(queueLength()).toBe(1)
  })

  it('queues the attempt on a 5xx response instead of showing a plain error', async () => {
    fetchMock.mockResolvedValue({ status: 500, json: async () => ({ ok: false, error: 'boom' }) })
    render(<InAppCheckIn phase="am" onSuccess={jest.fn()} />)

    fireEvent.click(await screen.findByText('Morning Check-in'))

    expect(await screen.findByTestId('checkin-queued')).toBeInTheDocument()
    expect(queueLength()).toBe(1)
  })

  it('does NOT queue a definitive 4xx rejection (e.g. outside fence) from a fresh tap', async () => {
    fetchMock.mockResolvedValue({ status: 422, json: async () => ({ ok: false, error: 'You need to be at the academy to check in from the app.' }) })
    render(<InAppCheckIn phase="am" onSuccess={jest.fn()} />)

    fireEvent.click(await screen.findByText('Morning Check-in'))

    expect(await screen.findByText('You need to be at the academy to check in from the app.')).toBeInTheDocument()
    expect(queueLength()).toBe(0)
  })

  it('flushes a queued item on the online event, succeeds, empties the queue, calls onSuccess and refreshes', async () => {
    seedQueuedAm()
    const onSuccess = jest.fn()
    fetchMock.mockResolvedValue({ status: 200, json: async () => ({ ok: true, success: true, id: 'row-1' }) })
    render(<InAppCheckIn phase="am" onSuccess={onSuccess} />)

    await act(async () => { window.dispatchEvent(new Event('online')) })

    await waitFor(() => expect(queueLength()).toBe(0))
    await waitFor(() => expect(onSuccess).toHaveBeenCalled())
    expect(mockRefresh).toHaveBeenCalled()
  })

  it('treats an alreadyCheckedIn:true flush response as success and empties the queue', async () => {
    seedQueuedAm()
    fetchMock.mockResolvedValue({ status: 200, json: async () => ({ ok: true, alreadyCheckedIn: true }) })
    render(<InAppCheckIn phase="am" onSuccess={jest.fn()} />)

    await act(async () => { window.dispatchEvent(new Event('online')) })

    await waitFor(() => expect(queueLength()).toBe(0))
  })

  it('drops the queued item and shows the server error on a 4xx (window closed) flush', async () => {
    seedQueuedAm()
    fetchMock.mockResolvedValue({ status: 422, json: async () => ({ ok: false, error: 'Check-in isn not open right now' }) })
    render(<InAppCheckIn phase="am" onSuccess={jest.fn()} />)

    await act(async () => { window.dispatchEvent(new Event('online')) })

    await waitFor(() => expect(queueLength()).toBe(0))
    expect(await screen.findByText('Check-in isn not open right now')).toBeInTheDocument()
  })

  it('keeps a queued item queued if the flush attempt itself hits a 5xx', async () => {
    seedQueuedAm()
    fetchMock.mockResolvedValue({ status: 503, json: async () => ({ ok: false, error: 'boom' }) })
    render(<InAppCheckIn phase="am" onSuccess={jest.fn()} />)

    await act(async () => { window.dispatchEvent(new Event('online')) })

    await waitFor(() => expect(screen.getByTestId('checkin-queued')).toBeInTheDocument())
    expect(queueLength()).toBe(1)
  })

  it('shows the queued message immediately on mount when a same-day item is already queued', async () => {
    seedQueuedAm()
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch')) // still offline at mount
    render(<InAppCheckIn phase="am" onSuccess={jest.fn()} />)

    expect(await screen.findByTestId('checkin-queued')).toBeInTheDocument()
    expect(queueLength()).toBe(1)
  })
})
