/**
 * @jest-environment node
 */
const getUserMock = jest.fn()
const adminFromMock = jest.fn()
const anthropicCreateMock = jest.fn(() =>
  Promise.resolve({ content: [{ type: 'text', text: 'AI reply text' }] })
)
const autoRaiseConcernMock = jest.fn(() => Promise.resolve({ raised: true }))

jest.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ auth: { getUser: getUserMock } }),
}))
jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: adminFromMock }),
}))
jest.mock('@/lib/ai', () => ({
  getAnthropic: () => ({ messages: { create: (...args: unknown[]) => anthropicCreateMock(...args) } }),
  MODELS: { sonnet: 'claude-sonnet-4-5' },
  extractText: (response: { content: { type: string; text: string }[] }) =>
    response.content
      .filter((b: { type: string }) => b.type === 'text')
      .map((b: { text: string }) => b.text)
      .join('\n')
      .trim(),
}))
jest.mock('@/lib/safeguarding/autoRaiseConcern', () => ({
  autoRaiseConcern: (...args: unknown[]) => autoRaiseConcernMock(...args),
}))

import { POST } from '@/app/api/ai/chat/route'

const STUDENT_ID = 'student-1'
const ROOM_ID = 'room-1'

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/ai/chat', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

function setupAdmin(opts: {
  isMember?: boolean
  roomKind?: string | null
  history?: { sender_id: string; body: string }[]
  profileName?: string
} = {}) {
  const {
    isMember = true,
    roomKind = 'bot',
    history = [{ sender_id: STUDENT_ID, body: 'Hello' }],
    profileName = 'Test Student',
  } = opts

  adminFromMock.mockImplementation((table: string) => {
    if (table === 'chat_members') {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: isMember ? { user_id: STUDENT_ID } : null }) }),
          }),
        }),
      }
    }
    if (table === 'chat_rooms') {
      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: roomKind ? { kind: roomKind } : null }) }),
        }),
      }
    }
    if (table === 'chat_messages') {
      return {
        select: () => ({
          eq: () => ({ is: () => ({ order: () => ({ limit: async () => ({ data: history }) }) }) }),
        }),
        insert: async () => ({ error: null }),
      }
    }
    if (table === 'users') {
      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: { name: profileName, role: 'student' } }) }),
        }),
      }
    }
    throw new Error(`Unexpected table: ${table}`)
  })
}

beforeEach(() => {
  getUserMock.mockReset()
  adminFromMock.mockReset()
  anthropicCreateMock.mockClear()
  autoRaiseConcernMock.mockClear()
  getUserMock.mockResolvedValue({ data: { user: { id: STUDENT_ID } } })
})

describe('POST /api/ai/chat', () => {
  it('returns 401 when not authenticated', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } })
    const res = await POST(makeRequest({ roomId: ROOM_ID }))
    expect(res.status).toBe(401)
  })

  it('returns 403 for a non-member (e.g. a stale/invalid roomId), not a 500', async () => {
    setupAdmin({ isMember: false })
    const res = await POST(makeRequest({ roomId: ROOM_ID }))
    expect(res.status).toBe(403)
  })

  it('returns 400 when the room is not a bot room', async () => {
    setupAdmin({ roomKind: 'custom' })
    const res = await POST(makeRequest({ roomId: ROOM_ID }))
    expect(res.status).toBe(400)
  })

  it('replies normally and does not raise a concern for an ordinary message', async () => {
    setupAdmin({ history: [{ sender_id: STUDENT_ID, body: 'How was training today?' }] })
    const res = await POST(makeRequest({ roomId: ROOM_ID }))
    expect(res.status).toBe(200)
    expect(anthropicCreateMock).toHaveBeenCalledTimes(1)
    expect(autoRaiseConcernMock).not.toHaveBeenCalled()
  })

  it('still replies AND raises a concern when the message matches distress signals', async () => {
    setupAdmin({ history: [{ sender_id: STUDENT_ID, body: "I've been thinking about ending my life" }] })
    const res = await POST(makeRequest({ roomId: ROOM_ID }))
    expect(res.status).toBe(200)
    expect(anthropicCreateMock).toHaveBeenCalledTimes(1)
    expect(autoRaiseConcernMock).toHaveBeenCalledTimes(1)
    const [, params] = autoRaiseConcernMock.mock.calls[0]
    expect(params).toEqual(
      expect.objectContaining({
        studentId: STUDENT_ID,
        category: 'wellbeing',
        severity: 'high',
        notifyUrl: `/chat/${ROOM_ID}`,
      })
    )
  })

  it('includes the distress-handling instructions in the system prompt sent to Claude', async () => {
    setupAdmin()
    await POST(makeRequest({ roomId: ROOM_ID }))
    const call = anthropicCreateMock.mock.calls[0][0] as { system: string }
    expect(call.system).toMatch(/Childline/)
    expect(call.system).toMatch(/Samaritans/)
  })
})
