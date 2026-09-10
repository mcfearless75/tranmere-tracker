import { act, render, screen, waitFor } from '@testing-library/react'
import type { GeoDiagnostic, GeoFix } from '@/lib/attendance/getGeoFix'

const mockReplace = jest.fn()
const mockPush = jest.fn()
const mockRefresh = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush, refresh: mockRefresh }),
}))

const mockGetGeoFix = jest.fn()
jest.mock('@/lib/attendance/getGeoFix', () => ({
  getGeoFix: (opts: { onDiagnostic?: (d: GeoDiagnostic) => void }) => mockGetGeoFix(opts),
}))

jest.mock('@/lib/reportClientError', () => ({ reportClientError: jest.fn() }))

import { AutoCheckIn } from '@/app/(student)/attendance/AutoCheckIn'

function geoDenied() {
  mockGetGeoFix.mockImplementation(async (opts: { onDiagnostic?: (d: GeoDiagnostic) => void }) => {
    opts.onDiagnostic?.({ highAccuracy: 'permission-denied', lowAccuracy: 'permission-denied' })
    return null
  })
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
  // Fake timers so the 2.5s auto-return is asserted, not skipped. Async
  // mocks still resolve because microtasks are unaffected.
  jest.useFakeTimers()
  global.fetch = fetchMock as unknown as typeof fetch
  fetchMock.mockResolvedValue({ json: async () => ({ ok: true, success: true, id: 'row-1' }) })
})

afterEach(() => {
  jest.useRealTimers()
})

describe('AutoCheckIn', () => {
  it('tells the student how to re-enable location when the browser refused it, and forwards the reason', async () => {
    geoDenied()
    render(<AutoCheckIn phase="am" nfcToken="tok" />)

    expect(await screen.findByText('Morning sorted ✓')).toBeInTheDocument()
    const notice = await screen.findByTestId('location-denied-notice')
    expect(notice).toHaveTextContent('Location is switched off for this site')
    expect(notice).toHaveTextContent('Website Settings')

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string)
    expect(body).toMatchObject({ phase: 'am', nfc_token: 'tok', geo_lat: null, geo_permission_denied: true })

    // The screen must HOLD so the notice can be read — no auto-navigation.
    await act(async () => { jest.advanceTimersByTime(10_000) })
    expect(mockReplace).not.toHaveBeenCalled()
    expect(mockPush).not.toHaveBeenCalled()
    expect(mockRefresh).not.toHaveBeenCalled()
  })

  it('shows the notice on the already-checked-in screen too', async () => {
    geoDenied()
    fetchMock.mockResolvedValue({ json: async () => ({ ok: true, alreadyCheckedIn: true }) })
    render(<AutoCheckIn phase="lunch" nfcToken="tok" />)

    expect(await screen.findByText('Already checked in')).toBeInTheDocument()
    expect(await screen.findByTestId('location-denied-notice')).toBeInTheDocument()
  })

  it('shows no notice when a fix was obtained, and never calls router.refresh()', async () => {
    geoOk()
    render(<AutoCheckIn phase="pm" nfcToken="tok" />)

    expect(await screen.findByText('End of day sorted ✓')).toBeInTheDocument()
    expect(screen.queryByTestId('location-denied-notice')).not.toBeInTheDocument()

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string)
    expect(body).toMatchObject({ geo_lat: 53.4209, geo_lng: -3.0867, geo_accuracy_m: 12, geo_permission_denied: false })

    // Auto-return after the tick has been shown — via a single replace().
    // push()+refresh() in the same tick is a known trigger of the Next 14
    // router crash recorded on this exact URL in production.
    expect(mockReplace).not.toHaveBeenCalled()
    await act(async () => { jest.advanceTimersByTime(2_600) })
    expect(mockReplace).toHaveBeenCalledWith('/attendance')
    expect(mockRefresh).not.toHaveBeenCalled()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('surfaces a server error message without crashing', async () => {
    geoOk()
    fetchMock.mockResolvedValue({ json: async () => ({ ok: false, error: 'Outside morning check-in window' }) })
    render(<AutoCheckIn phase="am" nfcToken="tok" />)

    await waitFor(() => expect(screen.getByText('Check-in failed')).toBeInTheDocument())
    expect(screen.getByText('Outside morning check-in window')).toBeInTheDocument()
  })
})
