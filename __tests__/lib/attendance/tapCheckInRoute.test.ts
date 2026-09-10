/**
 * @jest-environment node
 *
 * In-app tap check-in (app/api/attendance/tap-checkin/route.ts). This path
 * has no physical proof, so the geofence is enforced. Covers the 2026-09-10
 * accuracy-aware fence: a coarse Wi-Fi fix whose error circle reaches the
 * academy is allowed but FLAGGED, and the client-controlled
 * geo_permission_denied bypass only counts when no coordinates were sent.
 */
import { NextRequest } from 'next/server'

const getUserMock = jest.fn()
const rpcMock = jest.fn()
const adminFromMock = jest.fn()
const recordAndNotifyRejectionMock = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ auth: { getUser: getUserMock }, rpc: rpcMock }),
}))
jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: adminFromMock }),
}))
jest.mock('@/lib/attendance/rejectionNotify', () => ({
  recordAndNotifyRejection: (...args: unknown[]) => recordAndNotifyRejectionMock(...args),
}))
jest.mock('@/lib/dates', () => ({ londonDateISO: () => '2026-09-10' }))

import { POST } from '@/app/api/attendance/tap-checkin/route'

// The Solar Campus, 250m radius (academy_settings defaults)
const ACADEMY = { nfc_token: 'sticker-token', geo_lat: 53.4209, geo_lng: -3.0867, radius_m: 250 }

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/attendance/tap-checkin', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

function setupAdmin() {
  const updateMock = jest.fn()
  adminFromMock.mockImplementation((table: string) => {
    if (table === 'academy_settings') {
      return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: ACADEMY, error: null }) }) }) }
    }
    if (table === 'daily_attendance') {
      return {
        select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
        update: (patch: Record<string, unknown>) => {
          updateMock(patch)
          return { eq: () => ({ eq: async () => ({ error: null }) }) }
        },
      }
    }
    throw new Error(`Unexpected table ${table}`)
  })
  return { updateMock }
}

beforeEach(() => {
  jest.clearAllMocks()
  getUserMock.mockResolvedValue({ data: { user: { id: 'student-1' } } })
  rpcMock.mockResolvedValue({ data: [{ id: 'rec-1', won: true }], error: null })
})

describe('POST /api/attendance/tap-checkin', () => {
  it('accepts a precise fix inside the radius with no flag', async () => {
    const { updateMock } = setupAdmin()
    const res = await POST(makeRequest({ phase: 'am', geo_lat: 53.4209, geo_lng: -3.0867, geo_accuracy_m: 15 }))
    expect(res.status).toBe(200)
    expect(rpcMock).toHaveBeenCalledWith('submit_daily_check_in', expect.objectContaining({ p_geo_accuracy_m: 15 }))
    expect(updateMock).not.toHaveBeenCalled()
    expect(recordAndNotifyRejectionMock).not.toHaveBeenCalled()
  })

  it('lets a coarse Wi-Fi fix through when its error circle covers the academy — but flags it', async () => {
    // ~3.3km north (the identical-coordinates signature seen live on 2026-09-07 PM), ±3400m
    const { updateMock } = setupAdmin()
    const res = await POST(makeRequest({ phase: 'pm', geo_lat: 53.4209 + 0.03, geo_lng: -3.0867, geo_accuracy_m: 3400 }))
    expect(res.status).toBe(200)
    expect(recordAndNotifyRejectionMock).not.toHaveBeenCalled()
    expect(updateMock).toHaveBeenCalledTimes(1)
    const patch = updateMock.mock.calls[0][0]
    expect(patch.pm_is_flagged).toBe(true)
    expect(patch.pm_flag_reason).toMatch(/^GPS 3\d{3}m from academy \(±3400m accuracy\) — coarse fix, in-app tap$/)
  })

  it('still rejects a coarse fix whose error circle does not reach the academy', async () => {
    setupAdmin()
    const res = await POST(makeRequest({ phase: 'pm', geo_lat: 53.4209 + 0.03, geo_lng: -3.0867, geo_accuracy_m: 500 }))
    expect(res.status).toBe(422)
    expect(recordAndNotifyRejectionMock).toHaveBeenCalledWith(expect.anything(), 'student-1', '2026-09-10', 'pm', expect.any(Number))
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('honours the permission-denied bypass only when NO coordinates were sent', async () => {
    const { updateMock } = setupAdmin()
    const res = await POST(makeRequest({ phase: 'am', geo_lat: null, geo_lng: null, geo_permission_denied: true }))
    expect(res.status).toBe(200)
    expect(recordAndNotifyRejectionMock).not.toHaveBeenCalled()
    expect(updateMock).toHaveBeenCalledWith({
      am_is_flagged: true,
      am_flag_reason: 'Location permission denied on device — check-in allowed without GPS proof',
    })
  })

  it('ignores geo_permission_denied when real off-site coordinates were sent', async () => {
    setupAdmin()
    const res = await POST(makeRequest({ phase: 'am', geo_lat: 53.0, geo_lng: -3.0, geo_accuracy_m: 10, geo_permission_denied: true }))
    expect(res.status).toBe(422)
    expect(recordAndNotifyRejectionMock).toHaveBeenCalled()
    expect(rpcMock).not.toHaveBeenCalled()
  })
})
