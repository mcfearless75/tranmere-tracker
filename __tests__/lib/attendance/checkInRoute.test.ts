/**
 * @jest-environment node
 *
 * Unit tests for the NFC sticker check-in API handler
 * (app/api/attendance/check-in/route.ts), focused on the 2026-09-10
 * permission-denied relabeling fix: AutoCheckIn.tsx now reports whether the
 * browser flatly refused location, and this route should relabel the RPC's
 * generic "No GPS provided" flag reason so staff see the real cause instead
 * of a misleading truancy signal.
 */
import { NextRequest } from 'next/server'

const getUserMock = jest.fn()
const rpcMock = jest.fn()
const adminFromMock = jest.fn()
const notifyParentsOfCheckInMock = jest.fn()
const notifyStaffOfFlaggedCheckInMock = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: { getUser: getUserMock },
    rpc: rpcMock,
  }),
}))

jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: adminFromMock,
  }),
}))

jest.mock('@/lib/attendance/parentNotifyUtils', () => ({
  notifyParentsOfCheckIn: (...args: unknown[]) => notifyParentsOfCheckInMock(...args),
}))

jest.mock('@/lib/attendance/staffFlagNotify', () => ({
  notifyStaffOfFlaggedCheckIn: (...args: unknown[]) => notifyStaffOfFlaggedCheckInMock(...args),
}))

jest.mock('@/lib/dates', () => ({
  londonDateISO: () => '2026-09-10',
}))

import { POST } from '@/app/api/attendance/check-in/route'

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/attendance/check-in', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

const validBody = {
  phase: 'am',
  nfc_token: 'sticker-token',
  geo_lat: null,
  geo_lng: null,
  geo_accuracy_m: null,
  selfie_path: null,
}

/** Builds the admin .from('daily_attendance') router used by the handler. */
function setupAdmin(opts: {
  alreadyCheckedIn?: boolean
  flagged?: boolean
  flagReason?: string
}) {
  const { alreadyCheckedIn = false, flagged = false, flagReason = 'No GPS provided' } = opts

  const updateMock = jest.fn()

  adminFromMock.mockImplementation((table: string) => {
    if (table !== 'daily_attendance') throw new Error(`Unexpected table ${table}`)
    return {
      select: (cols: string) => {
        // Idempotency check (pre-RPC)
        if (cols.includes('checked_at')) {
          return {
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: alreadyCheckedIn ? { am_checked_at: '2026-09-10T08:00:00Z' } : null,
                  error: null,
                }),
              }),
            }),
          }
        }
        // Post-RPC flag lookup (`${phase}_is_flagged, ${phase}_flag_reason`)
        return {
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { am_is_flagged: flagged, am_flag_reason: flagReason },
                error: null,
              }),
            }),
          }),
        }
      },
      update: (patch: Record<string, unknown>) => {
        updateMock(patch)
        return {
          eq: () => ({
            eq: () => ({
              eq: async () => ({ error: null }),
            }),
          }),
        }
      },
    }
  })

  return { updateMock }
}

beforeEach(() => {
  getUserMock.mockReset()
  rpcMock.mockReset()
  adminFromMock.mockReset()
  notifyParentsOfCheckInMock.mockReset().mockResolvedValue(undefined)
  notifyStaffOfFlaggedCheckInMock.mockReset().mockResolvedValue(undefined)
})

describe('POST /api/attendance/check-in', () => {
  it('returns 401 when not authenticated', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } })
    setupAdmin({})
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(401)
  })

  it('returns 400 when the NFC token is missing', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'student-1' } } })
    setupAdmin({})
    const res = await POST(makeRequest({ ...validBody, nfc_token: '' }))
    expect(res.status).toBe(400)
  })

  it('short-circuits with alreadyCheckedIn and never calls the RPC on a repeat tap', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'student-1' } } })
    setupAdmin({ alreadyCheckedIn: true })
    const res = await POST(makeRequest(validBody))
    const json = await res.json()
    expect(json.alreadyCheckedIn).toBe(true)
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('does not relabel or notify staff for a clean, unflagged check-in', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'student-1' } } })
    const { updateMock } = setupAdmin({ flagged: false })
    rpcMock.mockResolvedValue({ data: [{ id: 'rec-1', won: true }], error: null })

    const res = await POST(makeRequest({ ...validBody, geo_lat: 53.4, geo_lng: -3.0 }))
    expect(res.status).toBe(200)
    expect(updateMock).not.toHaveBeenCalled()
    expect(notifyStaffOfFlaggedCheckInMock).not.toHaveBeenCalled()
  })

  it('flags with the generic RPC reason when the client did not report permission-denied', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'student-1' } } })
    const { updateMock } = setupAdmin({ flagged: true, flagReason: 'No GPS provided' })
    rpcMock.mockResolvedValue({ data: [{ id: 'rec-1', won: true }], error: null })

    const res = await POST(makeRequest(validBody)) // no geo_permission_denied field
    expect(res.status).toBe(200)
    expect(updateMock).not.toHaveBeenCalled()
    expect(notifyStaffOfFlaggedCheckInMock).toHaveBeenCalledWith(
      expect.anything(), 'student-1', 'am', 'No GPS provided',
    )
  })

  it('relabels the flag reason but does NOT push staff when geo_permission_denied is true', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'student-1' } } })
    const relabeled = 'Location permission denied on device — check-in allowed without GPS proof'
    const { updateMock } = setupAdmin({ flagged: true, flagReason: relabeled })
    rpcMock.mockResolvedValue({ data: [{ id: 'rec-1', won: true }], error: null })

    const res = await POST(makeRequest({ ...validBody, geo_permission_denied: true }))
    expect(res.status).toBe(200)

    // The flag stays visible in the day view with the honest reason…
    expect(updateMock).toHaveBeenCalledWith({ am_flag_reason: relabeled })
    // …but a browser setting is not a truancy signal: ~100 of these pushes
    // in 48h (2026-09-08 → 10) were drowning out the flags that need a human.
    expect(notifyStaffOfFlaggedCheckInMock).not.toHaveBeenCalled()
  })

  it('never fires staff/parent notifications for a racing duplicate call (won: false)', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'student-1' } } })
    setupAdmin({ flagged: true })
    rpcMock.mockResolvedValue({ data: [{ id: 'rec-1', won: false }], error: null })

    const res = await POST(makeRequest({ ...validBody, geo_permission_denied: true }))
    expect(res.status).toBe(200)
    expect(notifyParentsOfCheckInMock).not.toHaveBeenCalled()
    expect(notifyStaffOfFlaggedCheckInMock).not.toHaveBeenCalled()
  })
})
