import { flatEarthDistanceMetres, isInsideFence } from '@/lib/attendance/geoUtils'

// The Solar Campus (academy_settings defaults from 017_daily_attendance.sql)
const ACADEMY_LAT = 53.4209
const ACADEMY_LNG = -3.0867
const RADIUS_M = 250

describe('flatEarthDistanceMetres', () => {
  it('returns 0 for the exact centre point', () => {
    expect(flatEarthDistanceMetres(ACADEMY_LAT, ACADEMY_LNG, ACADEMY_LAT, ACADEMY_LNG)).toBe(0)
  })

  it('measures ~111m for 0.001 degrees of latitude', () => {
    const d = flatEarthDistanceMetres(ACADEMY_LAT + 0.001, ACADEMY_LNG, ACADEMY_LAT, ACADEMY_LNG)
    expect(d).toBeGreaterThan(105)
    expect(d).toBeLessThan(118)
  })

  it('applies the cosine correction to longitude at academy latitude', () => {
    // At 53.42°N a degree of longitude is ~cos(53.42°) ≈ 0.596 of a latitude degree
    const dLng = flatEarthDistanceMetres(ACADEMY_LAT, ACADEMY_LNG + 0.001, ACADEMY_LAT, ACADEMY_LNG)
    const dLat = flatEarthDistanceMetres(ACADEMY_LAT + 0.001, ACADEMY_LNG, ACADEMY_LAT, ACADEMY_LNG)
    expect(dLng / dLat).toBeCloseTo(Math.cos((ACADEMY_LAT * Math.PI) / 180), 2)
  })

  it('puts the old NEXT_PUBLIC_GROUND_* fallback (~53.3963, -3.0942) well outside a 250m fence', () => {
    // This is the bug the geo-checkin route had: env fallback ~2.8km away
    const d = flatEarthDistanceMetres(53.3963, -3.0942, ACADEMY_LAT, ACADEMY_LNG)
    expect(d).toBeGreaterThan(2000)
  })

  it('is symmetric enough at short range regardless of argument order', () => {
    const a = flatEarthDistanceMetres(53.421, -3.087, ACADEMY_LAT, ACADEMY_LNG)
    const b = flatEarthDistanceMetres(ACADEMY_LAT, ACADEMY_LNG, 53.421, -3.087)
    expect(Math.abs(a - b)).toBeLessThan(1)
  })
})

describe('isInsideFence', () => {
  it('accepts a reading at the academy', () => {
    const r = isInsideFence(ACADEMY_LAT, ACADEMY_LNG, ACADEMY_LAT, ACADEMY_LNG, RADIUS_M)
    expect(r.inside).toBe(true)
    expect(r.distanceM).toBe(0)
  })

  it('accepts a reading just inside the radius', () => {
    // ~111m north of centre
    const r = isInsideFence(ACADEMY_LAT + 0.001, ACADEMY_LNG, ACADEMY_LAT, ACADEMY_LNG, RADIUS_M)
    expect(r.inside).toBe(true)
  })

  it('rejects a reading outside the radius and reports distance', () => {
    // ~334m north of centre
    const r = isInsideFence(ACADEMY_LAT + 0.003, ACADEMY_LNG, ACADEMY_LAT, ACADEMY_LNG, RADIUS_M)
    expect(r.inside).toBe(false)
    expect(r.distanceM).toBeGreaterThan(RADIUS_M)
  })

  it('treats a reading exactly on the radius as inside (<=)', () => {
    const r = isInsideFence(ACADEMY_LAT, ACADEMY_LNG, ACADEMY_LAT, ACADEMY_LNG, 0)
    expect(r.inside).toBe(true)
  })

  it.each([
    ['null lat', null, -3.0867],
    ['null lng', 53.4209, null],
    ['undefined lat', undefined, -3.0867],
    ['undefined lng', 53.4209, undefined],
    ['NaN lat', NaN, -3.0867],
    ['Infinity lng', 53.4209, Infinity],
  ])('treats %s as outside with null distance', (_label, lat, lng) => {
    const r = isInsideFence(lat as number | null | undefined, lng as number | null | undefined, ACADEMY_LAT, ACADEMY_LNG, RADIUS_M)
    expect(r.inside).toBe(false)
    expect(r.distanceM).toBeNull()
  })

  it('rejects non-number coordinate types smuggled in as strings', () => {
    const r = isInsideFence('53.4209' as unknown as number, -3.0867, ACADEMY_LAT, ACADEMY_LNG, RADIUS_M)
    expect(r.inside).toBe(false)
    expect(r.distanceM).toBeNull()
  })
})
