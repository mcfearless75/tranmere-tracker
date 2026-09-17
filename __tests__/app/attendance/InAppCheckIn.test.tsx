import { fireEvent, render, screen } from '@testing-library/react'
import type { GeoDiagnostic, GeoFix } from '@/lib/attendance/getGeoFix'

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

describe('InAppCheckIn — enqueueing a fresh failed tap', () => {
  // Note: the actual RETRY (sending a queued item) is owned by
  // PhaseDayCard's sweep now, not by InAppCheckIn — see
  // __tests__/components/attendance/PhaseDayCard.test.tsx for that. This
  // file only covers InAppCheckIn's own responsibilities: enqueue-on-
  // failure for a fresh tap, and reflecting the isQueued/queueError props
  // PhaseDayCard passes down.

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

  it('notifies onQueueChange right after enqueueing, so a parent can refresh its pending indicator without waiting for a sweep', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    const onQueueChange = jest.fn()
    render(<InAppCheckIn phase="am" onSuccess={jest.fn()} onQueueChange={onQueueChange} />)

    fireEvent.click(await screen.findByText('Morning Check-in'))

    await screen.findByTestId('checkin-queued')
    expect(onQueueChange).toHaveBeenCalled()
  })

  it('does not enqueue a GPS-permission-denied rejection as if it were a network failure', async () => {
    // The server treats a genuine fence rejection as a normal 4xx even when
    // geo_permission_denied was sent — this path is untouched by the queue.
    fetchMock.mockResolvedValue({ status: 422, json: async () => ({ ok: false, error: 'You need to be at the academy to check in from the app.' }) })
    mockGetGeoFix.mockImplementation(async (opts: { onDiagnostic?: (d: GeoDiagnostic) => void }) => {
      opts.onDiagnostic?.({ highAccuracy: 'permission-denied', lowAccuracy: 'permission-denied' })
      return null
    })
    render(<InAppCheckIn phase="am" onSuccess={jest.fn()} />)

    fireEvent.click(await screen.findByText('Morning Check-in'))

    await screen.findByText('You need to be at the academy to check in from the app.')
    expect(queueLength()).toBe(0)
  })
})

describe('InAppCheckIn — reflecting the isQueued / queueError props from PhaseDayCard\'s sweep', () => {
  it('shows the "saved on this phone" message when isQueued is true on mount, without attempting any network call itself', async () => {
    render(<InAppCheckIn phase="am" onSuccess={jest.fn()} isQueued />)

    expect(await screen.findByTestId('checkin-queued')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('drops back to the idle button once isQueued flips back to false (the sweep resolved it)', async () => {
    const { rerender } = render(<InAppCheckIn phase="am" onSuccess={jest.fn()} isQueued />)
    expect(await screen.findByTestId('checkin-queued')).toBeInTheDocument()

    rerender(<InAppCheckIn phase="am" onSuccess={jest.fn()} isQueued={false} />)
    expect(await screen.findByText('Morning Check-in')).toBeInTheDocument()
  })

  it('shows a queueError from a sweep-driven 4xx rejection', async () => {
    render(<InAppCheckIn phase="am" onSuccess={jest.fn()} queueError="Morning check-in isn't open right now" />)

    expect(await screen.findByText("Morning check-in isn't open right now")).toBeInTheDocument()
  })
})
