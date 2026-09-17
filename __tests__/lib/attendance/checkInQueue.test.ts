import {
  enqueueCheckIn,
  flushQueuedCheckIn,
  getQueuedPhasesForToday,
  hasQueuedCheckInToday,
  type QueuedCheckIn,
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

  describe('hasQueuedCheckInToday / getQueuedPhasesForToday', () => {
    it('ignores items from a previous London day', () => {
      seedRawQueue([item({ phase: 'am', londonDate: '2020-01-01' })])
      expect(hasQueuedCheckInToday('am')).toBe(false)
      expect(getQueuedPhasesForToday()).toEqual([])
    })
  })

  describe('flushQueuedCheckIn', () => {
    it('returns "none" when nothing is queued for that phase', async () => {
      const submit = jest.fn()
      const result = await flushQueuedCheckIn('am', submit)
      expect(result).toEqual({ outcome: 'none' })
      expect(submit).not.toHaveBeenCalled()
    })

    it('drops a stale (previous-day) item without ever calling submit', async () => {
      seedRawQueue([item({ phase: 'am', londonDate: '2020-01-01' })])
      const submit = jest.fn()
      const result = await flushQueuedCheckIn('am', submit)
      expect(result).toEqual({ outcome: 'stale' })
      expect(submit).not.toHaveBeenCalled()
      expect(readRawQueue()).toHaveLength(0)
    })

    it('drops the item on success and reports "sent"', async () => {
      seedRawQueue([item({ phase: 'am' })])
      const submit = jest.fn().mockResolvedValue({ ok: true, status: 200 })
      const result = await flushQueuedCheckIn('am', submit)
      expect(result).toEqual({ outcome: 'sent' })
      expect(readRawQueue()).toHaveLength(0)
    })

    it('treats alreadyCheckedIn:true as success', async () => {
      seedRawQueue([item({ phase: 'lunch' })])
      const submit = jest.fn().mockResolvedValue({ ok: true, alreadyCheckedIn: true, status: 200 })
      const result = await flushQueuedCheckIn('lunch', submit)
      expect(result).toEqual({ outcome: 'sent' })
      expect(readRawQueue()).toHaveLength(0)
    })

    it('drops the item on a definitive 4xx and surfaces the server message', async () => {
      seedRawQueue([item({ phase: 'pm' })])
      const submit = jest.fn().mockResolvedValue({ ok: false, status: 422, error: 'Outside afternoon check-in window' })
      const result = await flushQueuedCheckIn('pm', submit)
      expect(result).toEqual({ outcome: 'dropped', error: 'Outside afternoon check-in window' })
      expect(readRawQueue()).toHaveLength(0)
    })

    it('keeps the item queued on a 5xx', async () => {
      seedRawQueue([item({ phase: 'am' })])
      const submit = jest.fn().mockResolvedValue({ ok: false, status: 500 })
      const result = await flushQueuedCheckIn('am', submit)
      expect(result).toEqual({ outcome: 'kept' })
      expect(readRawQueue()).toHaveLength(1)
    })

    it('keeps the item queued when submit throws (still offline)', async () => {
      seedRawQueue([item({ phase: 'am' })])
      const submit = jest.fn().mockRejectedValue(new Error('network down'))
      const result = await flushQueuedCheckIn('am', submit)
      expect(result).toEqual({ outcome: 'kept' })
      expect(readRawQueue()).toHaveLength(1)
    })

    it('only flushes the requested phase, leaving other queued phases untouched', async () => {
      seedRawQueue([item({ phase: 'am' }), item({ phase: 'lunch' })])
      const submit = jest.fn().mockResolvedValue({ ok: true, status: 200 })
      await flushQueuedCheckIn('am', submit)
      expect(submit).toHaveBeenCalledTimes(1)
      const remaining = readRawQueue()
      expect(remaining).toHaveLength(1)
      expect(remaining[0].phase).toBe('lunch')
    })
  })
})
