/**
 * @jest-environment node
 *
 * Regression coverage for the same "name field swallows the message" bug
 * class fixed app-wide 2026-09-14 — the gym log's custom-exercise name had
 * no length cap either.
 */
import { NextRequest } from 'next/server'

const getUserMock = jest.fn()
const fromMock = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: { getUser: getUserMock },
    from: fromMock,
  }),
}))

import { POST } from '@/app/api/gym/log/route'

function makeRequest(exercise: string): NextRequest {
  return new NextRequest('http://localhost/api/gym/log', {
    method: 'POST',
    body: JSON.stringify({ exercise }),
    headers: { 'Content-Type': 'application/json' },
  })
}

function setupFrom() {
  const single = jest.fn(async () => ({ data: { id: 'log-1' }, error: null }))
  const select = jest.fn(() => ({ single }))
  const insert = jest.fn(() => ({ select }))
  fromMock.mockImplementation((table: string) => {
    if (table === 'gym_logs') return { insert }
    throw new Error(`Unexpected table in test: ${table}`)
  })
  return { insert }
}

beforeEach(() => {
  getUserMock.mockReset()
  fromMock.mockReset()
})

describe('POST /api/gym/log', () => {
  it('rejects an exercise name over 60 characters and never logs it', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'student-1' } } })
    const { insert } = setupFrom()

    const res = await POST(makeRequest('A'.repeat(61)))

    expect(res.status).toBe(400)
    expect(insert).not.toHaveBeenCalled()
  })

  it('logs the exercise when the name is 60 characters or fewer', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'student-1' } } })
    const { insert } = setupFrom()

    const res = await POST(makeRequest('A'.repeat(60)))

    expect(res.status).toBe(200)
    expect(insert).toHaveBeenCalledTimes(1)
  })
})
