/**
 * @jest-environment node
 *
 * Regression coverage for the same "name field swallows the message" bug
 * class fixed app-wide 2026-09-14 — a goal title had no length cap either.
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

import { POST } from '@/app/api/goals/route'

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/goals', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

function validBody(title = 'Improve first touch') {
  return { title, category: 'football', priority: 'medium' }
}

function setupFrom() {
  const single = jest.fn(async () => ({ data: { id: 'goal-1' }, error: null }))
  const select = jest.fn(() => ({ single }))
  const insert = jest.fn(() => ({ select }))
  fromMock.mockImplementation((table: string) => {
    if (table === 'student_goals') return { insert }
    throw new Error(`Unexpected table in test: ${table}`)
  })
  return { insert }
}

beforeEach(() => {
  getUserMock.mockReset()
  fromMock.mockReset()
})

describe('POST /api/goals', () => {
  it('rejects a title over 60 characters and never creates the goal', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'student-1' } } })
    const { insert } = setupFrom()

    const res = await POST(makeRequest(validBody('A'.repeat(61))))

    expect(res.status).toBe(400)
    expect(insert).not.toHaveBeenCalled()
  })

  it('creates the goal when the title is 60 characters or fewer', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'student-1' } } })
    const { insert } = setupFrom()

    const res = await POST(makeRequest(validBody('A'.repeat(60))))

    expect(res.status).toBe(201)
    expect(insert).toHaveBeenCalledTimes(1)
  })
})
