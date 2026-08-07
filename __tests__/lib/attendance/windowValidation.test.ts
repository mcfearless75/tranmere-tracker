import { validateWindows, validateGeo, type WindowsInput } from '@/lib/attendance/windowValidation'

const good: WindowsInput = {
  am_window_start: '07:30', am_window_end: '10:30',
  lunch_window_start: '12:00', lunch_window_end: '13:30',
  pm_window_start: '14:30', pm_window_end: '17:30',
}

describe('validateWindows', () => {
  it('accepts ordered, non-overlapping windows', () => {
    expect(validateWindows(good)).toBeNull()
  })

  it('accepts HH:MM:SS (Postgres time format round-trip)', () => {
    expect(validateWindows({ ...good, am_window_start: '07:30:00' })).toBeNull()
  })

  it('accepts back-to-back windows (end == next start)', () => {
    expect(validateWindows({ ...good, am_window_end: '12:00' })).toBeNull()
  })

  it('rejects malformed times', () => {
    expect(validateWindows({ ...good, am_window_start: '7:30' })).toMatch(/AM start/)
    expect(validateWindows({ ...good, pm_window_end: '25:00' })).toMatch(/PM end/)
    expect(validateWindows({ ...good, lunch_window_start: 'noon' })).toMatch(/Lunch start/)
  })

  it('rejects a window whose start is not before its end', () => {
    expect(validateWindows({ ...good, am_window_start: '10:30' })).toMatch(/AM window/)
    expect(validateWindows({ ...good, lunch_window_end: '12:00' })).toMatch(/Lunch window/)
  })

  it('rejects overlapping phases', () => {
    expect(validateWindows({ ...good, lunch_window_start: '10:00' })).toMatch(/AM window must close/)
    expect(validateWindows({ ...good, pm_window_start: '13:00' })).toMatch(/Lunch window must close/)
  })
})

describe('validateGeo', () => {
  it('accepts the Solar Campus defaults', () => {
    expect(validateGeo({ geo_lat: 53.4209, geo_lng: -3.0867, radius_m: 250 })).toBeNull()
  })

  it('rejects out-of-range coordinates', () => {
    expect(validateGeo({ geo_lat: 91, geo_lng: 0, radius_m: 250 })).toMatch(/Latitude/)
    expect(validateGeo({ geo_lat: 0, geo_lng: -200, radius_m: 250 })).toMatch(/Longitude/)
    expect(validateGeo({ geo_lat: NaN, geo_lng: 0, radius_m: 250 })).toMatch(/Latitude/)
  })

  it('rejects bad radii', () => {
    expect(validateGeo({ geo_lat: 53, geo_lng: -3, radius_m: 5 })).toMatch(/Radius/)
    expect(validateGeo({ geo_lat: 53, geo_lng: -3, radius_m: 250.5 })).toMatch(/Radius/)
    expect(validateGeo({ geo_lat: 53, geo_lng: -3, radius_m: 999_999 })).toMatch(/Radius/)
  })
})
