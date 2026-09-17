import {
  enqueueCheckIn,
  flushAllQueued,
  getQueuedPhasesForToday,
  type QueuedCheckIn,
  type SubmitResult,
} from '@/lib/attendance/checkInQueue'
import { londonDateISO } from '@/lib/dates'

const QUEUE_KEY = 'checkin_queue_v1'

function seedRawQueue(items: QueuedCheckIn[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(items))
}

function readRawQueue(): QueuedCheckIn[] {
  const raw = localStorage.getItem(QUEUE_KEY)
  return raw ? JSON.parse(raw) : []
}

function item(overrides: Partial<QueuedCheckIn> = {}): QueuedCheckIn {
  return {
    phase: 'am',
    lat: 53.42,
    lng: -3.08,
    accuracy: 15,
    recordedAt: new Date().toISOString(),
    londonDate: londonDateISO(),
    ...overrides,
  }
}

afterEach(() => {
  localStorage.clear()
})

describe('checkInQueue', () => {
  describe('enqueueCheckIn', () => {
    it('adds a new item', () => {
      enqueueCheckIn({ phase: 'am', lat: 1, lng: 2, accuracy: 10, recordedAt: '2026-09-17T08:00:00Z' })
      expect(readRawQueue()).toHaveLength(1)
      expect(getQueuedPhasesForToday()).toEqual(['am'])
    })

    it('replaces an existing same-phase, same-day item rather than appending a duplicate', () => {
      enqueueCheckIn({ phase: 'am', lat: 1, lng: 2, accuracy: 10, recordedAt: '2026-09-17T08:00:00Z' })
      enqueueCheckIn({ phase: 'am', lat: 9, lng: 9, accuracy: 5, recordedAt: '2026-09-17T08:05:00Z' })
      const queue = readRawQueue()
      expect(queue).toHaveLength(1)
      expect(queue[0].lat).toBe(9)
      expect(queue[0].recordedAt).toBe('2026-09-17T08:05:00Z')
    })

    it('keeps separate items for different phases on the same day', () => {
      enqueueCheckIn({ phase: 'am', lat: 1, lng: 2, accuracy: 10, recordedAt: '2026-09-17T08:00:00Z' })
      enqueueCheckIn({ phase: 'lunch', lat: 1, lng: 2, accuracy: 10, recordedAt: '2026-09-17T12:00:00Z' })
      expect(getQueuedPhasesForToday().sort()).toEqual(['am', 'lunch'])
    })

    it('caps the queue at 5 items, dropping the oldest first', () => {
      const today = londonDateISO()
      // Seed 5 items across "different days" so none collide on the
      // phase+day replacement rule, then enqueue a 6th.
      seedRawQueue([
        item({ phase: 'am', londonDate: '2026-09-01' }),
        item({ phase: 'lunch', londonDate: '2026-09-02' }),
        item({ phase: 'pm', londonDate: '2026-09-03' }),
        item({ phase: 'am', londonDate: '2026-09-04' }),
        item({ phase: 'lunch', londonDate: '2026-09-05' }),
      ])
      enqueueCheckIn({ phase: 'pm', lat: 1, lng: 2, accuracy: 10, recordedAt: '2026-09-17T08:00:00Z' })
      const queue = readRawQueue()
      expect(queue).toHaveLength(5)
      // The oldest (2026-09-01 am) was evicted; the newest (today, pm) is present.
      expect(queue.find(q => q.londonDate === '2026-09-01')).toBeUndefined()
      expect(queue.find(q => q.londonDate === today && q.phase === 'pm')).toBeDefined()
    })
  })

  describe('getQueuedPhasesForToday', () => {
    it('ignores items from a previous London day', () => {
      seedRawQueue([item({ phase: 'am', londonDate: '2020-01-01' })])
      expect(getQueuedPhasesForToday()).toEqual([])
    })
  })

  describe('flushAllQueued', () => {
    it('returns an empty array when nothing is queued', async () => {
      const submit = jest.fn()
      const results = await flushAllQueued(submit)
      expect(results).toEqual([])
      expect(submit).not.toHaveBeenCalled()
    })

    it('prunes a stale (previous-day) item WITHOUT ever calling submit for it — this is the path that was previously unreachable in production', async () => {
      seedRawQueue([item({ phase: 'am', londonDate: '2020-01-01' })])
      const submit = jest.fn()
      const results = await flushAllQueued(submit)
      expect(results).toEqual([{ phase: 'am', outcome: 'stale' }])
      expect(submit).not.toHaveBeenCalled()
      expect(readRawQueue()).toHaveLength(0)
    })

    it('drops the item on success and reports "sent"', async () => {
      seedRawQueue([item({ phase: 'am' })])
      const submit = jest.fn().mockResolvedValue({ ok: true, status: 200 })
      const results = await flushAllQueued(submit)
      expect(results).toEqual([{ phase: 'am', outcome: 'sent' }])
      expect(readRawQueue()).toHaveLength(0)
    })

    it('treats alreadyCheckedIn:true as success', async () => {
      seedRawQueue([item({ phase: 'lunch' })])
      const submit = jest.fn().mockResolvedValue({ ok: true, alreadyCheckedIn: true, status: 200 })
      const results = await flushAllQueued(submit)
      expect(results).toEqual([{ phase: 'lunch', outcome: 'sent' }])
      expect(readRawQueue()).toHaveLength(0)
    })

    it('drops the item on a definitive 4xx and surfaces the server message', async () => {
      seedRawQueue([item({ phase: 'pm' })])
      const submit = jest.fn().mockResolvedValue({ ok: false, status: 422, error: 'Outside afternoon check-in window' })
      const results = await flushAllQueued(submit)
      expect(results).toEqual([{ phase: 'pm', outcome: 'dropped', error: 'Outside afternoon check-in window' }])
      expect(readRawQueue()).toHaveLength(0)
    })

    it('keeps the item queued on a 5xx', async () => {
      seedRawQueue([item({ phase: 'am' })])
      const submit = jest.fn().mockResolvedValue({ ok: false, status: 500 })
      const results = await flushAllQueued(submit)
      expect(results).toEqual([{ phase: 'am', outcome: 'kept' }])
      expect(readRawQueue()).toHaveLength(1)
    })

    it('keeps the item queued when submit throws (still offline)', async () => {
      seedRawQueue([item({ phase: 'am' })])
      const submit = jest.fn().mockRejectedValue(new Error('network down'))
      const results = await flushAllQueued(submit)
      expect(results).toEqual([{ phase: 'am', outcome: 'kept' }])
      expect(readRawQueue()).toHaveLength(1)
    })

    it('sweeps every phase in the queue, not just one — this is the fix for the cross-phase orphan bug', async () => {
      const today = londonDateISO()
      seedRawQueue([
        item({ phase: 'am', londonDate: today }),
        item({ phase: 'lunch', londonDate: today }),
        item({ phase: 'pm', londonDate: today }),
      ])
      const submit = jest.fn(async (queued: QueuedCheckIn): Promise<SubmitResult> => {
        // AM succeeds, lunch is rejected outright, pm is still 5xx-flaky.
        if (queued.phase === 'am') return { ok: true, status: 200 }
        if (queued.phase === 'lunch') return { ok: false, status: 422, error: 'Lunch window closed' }
        return { ok: false, status: 503 }
      })
      const results = await flushAllQueued(submit)
      expect(submit).toHaveBeenCalledTimes(3)
      expect(results).toEqual([
        { phase: 'am', outcome: 'sent' },
        { phase: 'lunch', outcome: 'dropped', error: 'Lunch window closed' },
        { phase: 'pm', outcome: 'kept' },
      ])
      // am (sent) and lunch (dropped) are gone; pm (kept) remains queued.
      const remaining = readRawQueue()
      expect(remaining).toHaveLength(1)
      expect(remaining[0].phase).toBe('pm')
    })

    it('prunes a stale item for one phase while still attempting a same-day item for another', async () => {
      const today = londonDateISO()
      seedRawQueue([
        item({ phase: 'am', londonDate: '2020-01-01' }),
        item({ phase: 'lunch', londonDate: today }),
      ])
      const submit = jest.fn().mockResolvedValue({ ok: true, status: 200 })
      const results = await flushAllQueued(submit)
      expect(submit).toHaveBeenCalledTimes(1) // only for the same-day lunch item
      expect(results).toEqual([
        { phase: 'am', outcome: 'stale' },
        { phase: 'lunch', outcome: 'sent' },
      ])
      expect(readRawQueue()).toHaveLength(0)
    })

    it('sweeps oldest-first (queue insertion order)', async () => {
      const today = londonDateISO()
      seedRawQueue([
        item({ phase: 'am', londonDate: today, recordedAt: '2026-09-17T07:00:00Z' }),
        item({ phase: 'lunch', londonDate: today, recordedAt: '2026-09-17T12:00:00Z' }),
      ])
      const order: string[] = []
      const submit = jest.fn(async (queued: QueuedCheckIn) => {
        order.push(queued.phase)
        return { ok: true, status: 200 }
      })
      await flushAllQueued(submit)
      expect(order).toEqual(['am', 'lunch'])
    })
  })
})
