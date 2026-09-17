import { postExcuse, postManualOverride } from '@/lib/attendance/attendanceClient'

describe('postExcuse', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('POSTs the request body verbatim to /api/attendance/excuse', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true })
    global.fetch = fetchMock as unknown as typeof fetch

    await postExcuse({ studentId: 's1', date: '2026-09-17', action: 'excuse', reason: 'other', phases: ['lunch'] })

    expect(fetchMock).toHaveBeenCalledWith('/api/attendance/excuse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: 's1', date: '2026-09-17', action: 'excuse', reason: 'other', phases: ['lunch'] }),
    })
  })

  it('throws with the server-provided error message on failure', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Already checked in' }),
    })
    global.fetch = fetchMock as unknown as typeof fetch

    await expect(
      postExcuse({ studentId: 's1', date: '2026-09-17', action: 'clear' })
    ).rejects.toThrow('Already checked in')
  })

  it('throws even when the error body cannot be parsed', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.reject(new Error('not json')),
    })
    global.fetch = fetchMock as unknown as typeof fetch

    await expect(
      postExcuse({ studentId: 's1', date: '2026-09-17', action: 'clear' })
    ).rejects.toThrow()
  })
})

describe('postManualOverride', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('POSTs the request body verbatim to /api/attendance/manual-override', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true })
    global.fetch = fetchMock as unknown as typeof fetch

    await postManualOverride({ studentId: 's1', date: '2026-09-17', phase: 'lunch', action: 'mark_present' })

    expect(fetchMock).toHaveBeenCalledWith('/api/attendance/manual-override', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: 's1', date: '2026-09-17', phase: 'lunch', action: 'mark_present' }),
    })
  })

  it('throws on a non-ok response', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: false })
    global.fetch = fetchMock as unknown as typeof fetch

    await expect(
      postManualOverride({ studentId: 's1', date: '2026-09-17', phase: 'lunch', action: 'mark_present' })
    ).rejects.toThrow()
  })

  it('throws with the server-provided error message on failure (Finding 4 — was a generic Error() with no message)', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Student not found' }),
    })
    global.fetch = fetchMock as unknown as typeof fetch

    await expect(
      postManualOverride({ studentId: 's1', date: '2026-09-17', phase: 'lunch', action: 'mark_present' })
    ).rejects.toThrow('Student not found')
  })
})
