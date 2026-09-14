/**
 * @jest-environment node
 *
 * Regression coverage for the same "name field swallows the message" bug
 * class fixed app-wide 2026-09-14 — the GPS import form's optional session
 * label had no length cap either. Only the human-typed form field is
 * capped; a CSV row's own session_label column is untouched (third-party
 * export data, not someone typing a message into a name box).
 */
import { NextRequest } from 'next/server'

const requireStaffMock = jest.fn()

jest.mock('@/lib/auth/requireRole', () => ({
  requireStaff: () => requireStaffMock(),
}))

import { POST } from '@/app/api/admin/gps-import/route'

function makeRequest(sessionLabel: string): NextRequest {
  const form = new FormData()
  form.set('session_label', sessionLabel)
  form.set('file', new File(['Name,Date\nJohn Smith,01/09/2026'], 'session.csv', { type: 'text/csv' }))
  return new NextRequest('http://localhost/api/admin/gps-import', { method: 'POST', body: form })
}

function authorizeAsStaff() {
  requireStaffMock.mockResolvedValue({
    ok: true,
    ctx: { user: { id: 'u1' }, role: 'admin', admin: { from: jest.fn() } },
  })
}

beforeEach(() => {
  requireStaffMock.mockReset()
})

describe('POST /api/admin/gps-import', () => {
  it('rejects a session label over 60 characters before touching the file', async () => {
    authorizeAsStaff()

    const res = await POST(makeRequest('A'.repeat(61)))

    expect(res.status).toBe(400)
  })
})
