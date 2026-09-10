/**
 * @jest-environment node
 */
const getUserMock = jest.fn()
const supabaseFromMock = jest.fn()
const adminFromMock = jest.fn()
const notifyUsersMock = jest.fn(() => Promise.resolve())

jest.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ auth: { getUser: getUserMock }, from: supabaseFromMock }),
}))
jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: adminFromMock }),
}))
jest.mock('@/lib/notifications/notifyStaff', () => ({
  notifyUsers: (...args: unknown[]) => notifyUsersMock(...args),
}))

import { NextRequest } from 'next/server'
import { POST } from '@/app/api/wellbeing/submit/route'

const STUDENT_ID = 'student-1'
const SURVEY_ID = 'survey-1'
const VALID_ANSWERS = { mood: 5, sleep: 5, energy: 5, stress: 1, connection: 5, football_enjoyment: 5 }

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/wellbeing/submit', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Wires the user-scoped supabase client used for survey lookup/insert/update. */
function setupSupabase(opts: { surveyExists?: boolean; insertError?: { message: string } | null } = {}) {
  const { surveyExists = true, insertError = null } = opts

  const updateMock = jest.fn(() => ({ eq: async () => ({ data: null, error: null }) }))

  supabaseFromMock.mockImplementation((table: string) => {
    if (table === 'wellbeing_surveys') {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: surveyExists ? { id: SURVEY_ID, status: 'open' } : null }),
              }),
            }),
          }),
        }),
        update: updateMock,
      }
    }
    if (table === 'wellbeing_responses') {
      return { insert: async () => ({ error: insertError }) }
    }
    throw new Error(`Unexpected table (supabase): ${table}`)
  })

  return { updateMock }
}

/** Wires the admin client used inside notifyStaffOfRedFlag. */
function setupAdmin(opts: { staffIds?: string[] } = {}) {
  const { staffIds = ['staff-1', 'staff-2'] } = opts

  adminFromMock.mockImplementation((table: string) => {
    if (table === 'users') {
      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: { name: 'Test Student' } }) }),
          in: () => Promise.resolve({ data: staffIds.map(id => ({ id })) }),
        }),
      }
    }
    throw new Error(`Unexpected table (admin): ${table}`)
  })
}

beforeEach(() => {
  getUserMock.mockReset()
  supabaseFromMock.mockReset()
  adminFromMock.mockReset()
  notifyUsersMock.mockClear()
  getUserMock.mockResolvedValue({ data: { user: { id: STUDENT_ID } } })
})

describe('POST /api/wellbeing/submit', () => {
  it('returns 401 when not authenticated', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } })
    const res = await POST(makeRequest({ survey_id: SURVEY_ID, answers: VALID_ANSWERS, notes: {} }))
    expect(res.status).toBe(401)
  })

  it('returns 404 when the survey is not open / not found', async () => {
    setupSupabase({ surveyExists: false })
    const res = await POST(makeRequest({ survey_id: SURVEY_ID, answers: VALID_ANSWERS, notes: {} }))
    expect(res.status).toBe(404)
  })

  it('saves the survey and does NOT notify staff when there are no red flags', async () => {
    setupSupabase()
    setupAdmin()
    const res = await POST(makeRequest({ survey_id: SURVEY_ID, answers: VALID_ANSWERS, notes: {} }))
    expect(res.status).toBe(200)
    expect(notifyUsersMock).not.toHaveBeenCalled()
  })

  it('notifies staff via notifyUsers when a response is red-flagged', async () => {
    setupSupabase()
    setupAdmin({ staffIds: ['staff-1', 'staff-2'] })
    const flaggedAnswers = { ...VALID_ANSWERS, mood: 1 } // low mood → red flag
    const res = await POST(makeRequest({ survey_id: SURVEY_ID, answers: flaggedAnswers, notes: {} }))
    expect(res.status).toBe(200)
    expect(notifyUsersMock).toHaveBeenCalledTimes(1)
    const [, staffIds, notification] = notifyUsersMock.mock.calls[0]
    expect([...staffIds].sort()).toEqual(['staff-1', 'staff-2'])
    expect(notification).toEqual(expect.objectContaining({ title: 'Wellbeing alert', url: '/admin/wellbeing' }))
    expect(notification.body).toContain('Test Student')
  })

  it('saves context_tags on the survey when provided', async () => {
    const { updateMock } = setupSupabase()
    setupAdmin()
    const res = await POST(makeRequest({
      survey_id: SURVEY_ID, answers: VALID_ANSWERS, notes: {}, context_tags: ['home', 'money'],
    }))
    expect(res.status).toBe(200)
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ context_tags: ['home', 'money'] }))
  })

  it('defaults context_tags to null when not provided', async () => {
    const { updateMock } = setupSupabase()
    setupAdmin()
    const res = await POST(makeRequest({ survey_id: SURVEY_ID, answers: VALID_ANSWERS, notes: {} }))
    expect(res.status).toBe(200)
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ context_tags: null }))
  })

  it('rejects more than 2 context_tags with 400', async () => {
    setupSupabase()
    const res = await POST(makeRequest({
      survey_id: SURVEY_ID, answers: VALID_ANSWERS, notes: {}, context_tags: ['home', 'money', 'friends'],
    }))
    expect(res.status).toBe(400)
  })

  it('rejects an unrecognized context tag with 400', async () => {
    setupSupabase()
    const res = await POST(makeRequest({
      survey_id: SURVEY_ID, answers: VALID_ANSWERS, notes: {}, context_tags: ['not-a-real-tag'],
    }))
    expect(res.status).toBe(400)
  })
})
