import { getGeoFix, type GeoDiagnostic } from '@/lib/attendance/getGeoFix'

/**
 * Regression coverage for the "No GPS provided" flagging incident: a
 * high-accuracy-only geolocation request flagged 100% of AM check-ins on
 * 2026-09-08 (up from 72% the day before, despite an earlier timeout
 * extension) — GPS satellite fixes routinely fail indoors near reception on
 * a cold first-tap-of-the-day, and no amount of extra waiting fixes that.
 * getGeoFix falls back to fast network-based positioning, which works
 * indoors, whenever the high-accuracy attempt comes back empty.
 */

type Coords = { latitude: number; longitude: number; accuracy: number }
type Outcome = { coords: Coords } | 'timeout' | { error: number }

function mockGeolocation(behavior: { highAccuracy?: Outcome; lowAccuracy?: Outcome }) {
  const getCurrentPosition = jest.fn(
    (
      success: (pos: { coords: Coords }) => void,
      error: (err: { code: number }) => void,
      options: PositionOptions,
    ) => {
      const outcome = options.enableHighAccuracy ? behavior.highAccuracy : behavior.lowAccuracy
      if (outcome === 'timeout') return // never calls back — the helper's own timer must fire
      if (outcome && 'error' in outcome) { error({ code: outcome.error }); return }
      if (outcome) success(outcome)
    },
  )
  // @ts-expect-error -- test-only partial mock of the Geolocation API
  global.navigator.geolocation = { getCurrentPosition }
  return getCurrentPosition
}

describe('getGeoFix', () => {
  const originalGeolocation = (global.navigator as any).geolocation

  afterEach(() => {
    // @ts-expect-error -- restoring the test-only partial mock
    global.navigator.geolocation = originalGeolocation
    jest.useRealTimers()
  })

  it('returns the high-accuracy fix immediately when it succeeds', async () => {
    mockGeolocation({ highAccuracy: { coords: { latitude: 53.39, longitude: -3.02, accuracy: 8 } } })
    const fix = await getGeoFix()
    expect(fix).toEqual({ lat: 53.39, lng: -3.02, accuracy: 8 })
  })

  // The core regression: high-accuracy fails (indoors, cold GPS chip), but
  // network-based positioning succeeds — this must not come back null.
  it('falls back to a low-accuracy fix when high-accuracy errors out', async () => {
    mockGeolocation({
      highAccuracy: { error: 2 }, // POSITION_UNAVAILABLE
      lowAccuracy: { coords: { latitude: 53.39, longitude: -3.02, accuracy: 65 } },
    })
    const fix = await getGeoFix()
    expect(fix).toEqual({ lat: 53.39, lng: -3.02, accuracy: 65 })
  })

  it('falls back to low-accuracy when high-accuracy times out (never calls back)', async () => {
    jest.useFakeTimers()
    mockGeolocation({
      highAccuracy: 'timeout',
      lowAccuracy: { coords: { latitude: 53.39, longitude: -3.02, accuracy: 40 } },
    })
    const promise = getGeoFix({ highAccuracyTimeoutMs: 1000, fallbackTimeoutMs: 1000 })
    // The helper's own backstop timer fires at timeoutMs + 1000 (slack past
    // the geolocation API's own timeout option, which isn't always honoured
    // precisely) — advance past that, not just highAccuracyTimeoutMs itself.
    await jest.advanceTimersByTimeAsync(2001)
    const fix = await promise
    expect(fix).toEqual({ lat: 53.39, lng: -3.02, accuracy: 40 })
  })

  it('returns null when both high- and low-accuracy fail', async () => {
    mockGeolocation({ highAccuracy: { error: 2 }, lowAccuracy: { error: 2 } })
    const fix = await getGeoFix()
    expect(fix).toBeNull()
  })

  // Same-day follow-up regression: after the low-accuracy fallback shipped,
  // ~54% of check-ins were STILL flagged. Permission-denied and
  // still-timed-out look identical as a bare null in daily_attendance, and
  // need opposite fixes — onDiagnostic must tell them apart.
  describe('onDiagnostic', () => {
    it('reports success on the high-accuracy attempt without touching lowAccuracy', async () => {
      mockGeolocation({ highAccuracy: { coords: { latitude: 1, longitude: 2, accuracy: 5 } } })
      let diagnostic: GeoDiagnostic | undefined
      await getGeoFix({ onDiagnostic: d => { diagnostic = d } })
      expect(diagnostic).toEqual({ highAccuracy: 'success' })
    })

    it('reports permission-denied (code 1) distinctly from position-unavailable (code 2)', async () => {
      mockGeolocation({ highAccuracy: { error: 1 }, lowAccuracy: { error: 1 } })
      let diagnostic: GeoDiagnostic | undefined
      await getGeoFix({ onDiagnostic: d => { diagnostic = d } })
      expect(diagnostic).toEqual({ highAccuracy: 'permission-denied', lowAccuracy: 'permission-denied' })
    })

    it('reports timeout when the helper\'s own backstop timer fires', async () => {
      jest.useFakeTimers()
      mockGeolocation({ highAccuracy: 'timeout', lowAccuracy: 'timeout' })
      let diagnostic: GeoDiagnostic | undefined
      const promise = getGeoFix({
        highAccuracyTimeoutMs: 1000,
        fallbackTimeoutMs: 1000,
        onDiagnostic: d => { diagnostic = d },
      })
      await jest.advanceTimersByTimeAsync(4001)
      await promise
      expect(diagnostic).toEqual({ highAccuracy: 'timeout', lowAccuracy: 'timeout' })
    })

    it('reports unsupported when there is no Geolocation API at all', async () => {
      // @ts-expect-error -- simulating an environment with no Geolocation API
      delete global.navigator.geolocation
      let diagnostic: GeoDiagnostic | undefined
      await getGeoFix({ onDiagnostic: d => { diagnostic = d } })
      expect(diagnostic).toEqual({ highAccuracy: 'unsupported' })
    })
  })

  it('never attempts the fallback when high-accuracy already succeeded', async () => {
    const getCurrentPosition = mockGeolocation({
      highAccuracy: { coords: { latitude: 1, longitude: 2, accuracy: 5 } },
    })
    await getGeoFix()
    expect(getCurrentPosition).toHaveBeenCalledTimes(1)
  })

  it('resolves null without touching the API when geolocation is unsupported', async () => {
    // @ts-expect-error -- simulating an environment with no Geolocation API
    delete global.navigator.geolocation
    await expect(getGeoFix()).resolves.toBeNull()
  })
})
