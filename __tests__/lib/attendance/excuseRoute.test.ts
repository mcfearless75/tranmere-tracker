/**
 * @jest-environment node
 *
 * Regression coverage for the Critical final-review finding: the 'excuse'
 * action used to `.upsert()` a whole attendance_excusals row, which REPLACED
 * whatever phases/reason/note were already recorded for that student+date.
 * Excusing AM then excusing lunch for the same student/date silently
 * un-excused AM. The fix (migration 071's
 * upsert_attendance_excusal_merge_phases RPC) unions phases atomically and
 * preserves the row's original reason/note once it exists. This test proves
 * the route calls the RPC (not a plain upsert) and that two sequential
 * per-phase excuse calls end up with BOTH phases, using a mock RPC handler
 * that reproduces the SQL function's real semantics (union phases, keep the
 * first call's reason/note on conflict) so the route-level contract is
 * verified even without a live Postgres instance in Jest.
 */
import { NextRequest } from 'next/server'

const requireStaffMock = jest.fn()

jest.mock('@/lib/auth/requireRole', () => ({
  requireStaff: () => requireStaffMock(),
}))

import { POST } from '@/app/api/attendance/excuse/route'

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/attendance/excuse', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * Simulates migration 071's SQL function: phases always UNION with whatever
 * is already stored; reason/note are only written on the first (insert)
 * call and are never touched by a later conflicting call — reproducing the
 * ON CONFLICT ... DO UPDATE SET phases = ... (reason/note absent from SET)
 * behaviour precisely, so this test fails if the route stops calling the
 * merge RPC or the RPC's contract changes.
 */
function makeMergeRpcMock() {
  let stored: { phases: string[]; reason: string; note: string | null } | null = null
  const rpc = jest.fn((fnName: string, params: Record<string, unknown>) => {
    if (fnName !== 'upsert_attendance_excusal_merge_phases') {
      throw new Error(`Unexpected rpc in test: ${fnName}`)
    }
    const incomingPhases = params.p_phases as string[]
    if (!stored) {
      stored = { phases: [...incomingPhases], reason: params.p_reason as string, note: params.p_note as string | null }
    } else {
      const union = Array.from(new Set([...stored.phases, ...incomingPhases]))
      stored = { phases: union, reason: stored.reason, note: stored.note }
    }
    return Promise.resolve({ data: [{ ...stored }], error: null })
  })
  return { rpc, getStored: () => stored }
}

function setupAdmin(opts: { rpc: jest.Mock; existingAttendance?: Record<string, unknown> | null }) {
  const { rpc, existingAttendance = null } = opts
  const from = jest.fn((table: string) => {
    if (table === 'users') {
      return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { id: 'student-1', role: 'student' } }) }) }) }
    }
    if (table === 'daily_attendance') {
      return {
        select: () => ({
          eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: existingAttendance, error: null }) }) }),
        }),
      }
    }
    throw new Error(`Unexpected table in test: ${table}`)
  })
  return { from, rpc }
}

function authorizeAsStaff(admin: ReturnType<typeof setupAdmin>) {
  requireStaffMock.mockResolvedValue({
    ok: true,
    ctx: { user: { id: 'staff-1' }, role: 'coach', admin },
  })
}

beforeEach(() => {
  requireStaffMock.mockReset()
})

describe('POST /api/attendance/excuse — partial-phases merge (Finding 1)', () => {
  it('excusing AM then excusing lunch for the same student/date results in phases containing BOTH, not just the latest call', async () => {
    const { rpc, getStored } = makeMergeRpcMock()
    const admin = setupAdmin({ rpc })
    authorizeAsStaff(admin)

    const firstRes = await POST(makeRequest({
      studentId: 'student-1', date: '2026-09-17', action: 'excuse', reason: 'ill', phases: ['am'],
    }))
    const firstBody = await firstRes.json()
    expect(firstRes.status).toBe(200)
    expect(firstBody.phases).toEqual(['am'])

    const secondRes = await POST(makeRequest({
      studentId: 'student-1', date: '2026-09-17', action: 'excuse', reason: 'other', phases: ['lunch'],
    }))
    const secondBody = await secondRes.json()
    expect(secondRes.status).toBe(200)

    // The critical assertion: AM must NOT have been dropped by the second call.
    expect(secondBody.phases).toEqual(expect.arrayContaining(['am', 'lunch']))
    expect(secondBody.phases).toHaveLength(2)

    // Merge precedence: the row's original reason ('ill', from the first
    // call) is preserved — the second call's 'other' does not overwrite it.
    expect(secondBody.reason).toBe('ill')
    expect(getStored()?.reason).toBe('ill')

    // The route must go through the atomic merge RPC, never a plain upsert.
    expect(rpc).toHaveBeenCalledWith('upsert_attendance_excusal_merge_phases', expect.objectContaining({
      p_student_id: 'student-1',
      p_excused_date: '2026-09-17',
    }))
    expect(rpc).toHaveBeenCalledTimes(2)
  })

  it('a single whole-day excuse still resolves to all three phases via the merge RPC', async () => {
    const { rpc } = makeMergeRpcMock()
    const admin = setupAdmin({ rpc })
    authorizeAsStaff(admin)

    const res = await POST(makeRequest({
      studentId: 'student-1', date: '2026-09-17', action: 'excuse', reason: 'appointment', note: 'Dentist',
    }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.phases).toEqual(expect.arrayContaining(['am', 'lunch', 'pm']))
    expect(body.reason).toBe('appointment')
  })
})
