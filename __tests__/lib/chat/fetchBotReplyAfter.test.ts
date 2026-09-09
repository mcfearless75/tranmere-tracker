import { fetchBotReplyAfter } from '@/app/chat/[roomId]/ChatThread'

const BOT_USER_ID = '00000000-0000-0000-0000-000000000099'
const ROOM_ID = 'room-1'
const SENT_AT = '2026-09-09T18:00:00.000Z'

/** Minimal admin-client double for the one table/chain this helper touches. */
function makeSupabaseMock(opts: {
  found?: { id: string; sender_id: string; body: string; attachment_url: null; attachment_kind: null; created_at: string }
  throws?: boolean
} = {}) {
  const { found = null, throws = false } = opts

  const maybeSingle = jest.fn(() => {
    if (throws) return Promise.reject(new Error('query failed'))
    return Promise.resolve({ data: found })
  })
  const limit = jest.fn(() => ({ maybeSingle }))
  const order = jest.fn(() => ({ limit }))
  const gt = jest.fn(() => ({ order }))
  const eq2 = jest.fn(() => ({ gt }))
  const eq1 = jest.fn(() => ({ eq: eq2 }))
  const select = jest.fn(() => ({ eq: eq1 }))

  const from = jest.fn((table: string) => {
    if (table === 'chat_messages') return { select }
    throw new Error(`Unexpected table in test: ${table}`)
  })

  return { from } as any
}

describe('fetchBotReplyAfter', () => {
  it('returns the message when the query finds one', async () => {
    const message = {
      id: 'm1',
      sender_id: BOT_USER_ID,
      body: 'Here you go',
      attachment_url: null,
      attachment_kind: null,
      created_at: '2026-09-09T18:00:05.000Z',
    }
    const supabase = makeSupabaseMock({ found: message })
    const result = await fetchBotReplyAfter(supabase, ROOM_ID, SENT_AT)
    expect(result).toEqual(message)
  })

  it('returns null when the query finds nothing', async () => {
    const supabase = makeSupabaseMock({ found: null })
    const result = await fetchBotReplyAfter(supabase, ROOM_ID, SENT_AT)
    expect(result).toBeNull()
  })

  it('returns null (not throw) when the query itself fails', async () => {
    const supabase = makeSupabaseMock({ throws: true })
    await expect(fetchBotReplyAfter(supabase, ROOM_ID, SENT_AT)).resolves.toBeNull()
  })

  it('queries with the correct room, sender, and sentAt filters', async () => {
    const supabase = makeSupabaseMock({ found: null })
    await fetchBotReplyAfter(supabase, ROOM_ID, SENT_AT)
    expect(supabase.from).toHaveBeenCalledWith('chat_messages')
  })
})
