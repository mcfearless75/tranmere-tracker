import { receiptMode, hasRead, advanceLastRead, summariseReceipt } from '@/lib/chat/receipts'

describe('receiptMode', () => {
  it('shows ticks to both sides of a DM', () => {
    expect(receiptMode('dm', false)).toBe('dm')
    expect(receiptMode('dm', true)).toBe('dm')
  })
  it('shows group counts to staff only', () => {
    expect(receiptMode('squad', true)).toBe('group')
    expect(receiptMode('custom', true)).toBe('group')
    expect(receiptMode('broadcast', true)).toBe('group')
    expect(receiptMode('squad', false)).toBe('none')
    expect(receiptMode('custom', false)).toBe('none')
  })
  it('never shows receipts in the AI Coach room', () => {
    expect(receiptMode('bot', true)).toBe('none')
  })
})

describe('hasRead', () => {
  const msg = '2026-09-29T12:00:00.000Z'
  it('is false with no read time', () => expect(hasRead(null, msg)).toBe(false))
  it('is false when read before the message', () => expect(hasRead('2026-09-29T11:59:59.000Z', msg)).toBe(false))
  it('is true when read at or after the message', () => {
    expect(hasRead(msg, msg)).toBe(true)
    expect(hasRead('2026-09-29T12:05:00.000Z', msg)).toBe(true)
  })
  it('compares instants, not strings (offset formats)', () => {
    expect(hasRead('2026-09-29T13:30:00+01:00', msg)).toBe(true)
  })
})

describe('advanceLastRead', () => {
  it('moves forward', () => {
    expect(advanceLastRead({ a: '2026-09-29T10:00:00Z' }, 'a', '2026-09-29T11:00:00Z')).toEqual({ a: '2026-09-29T11:00:00Z' })
  })
  it('never moves backward and keeps identity', () => {
    const map = { a: '2026-09-29T11:00:00Z' }
    expect(advanceLastRead(map, 'a', '2026-09-29T10:00:00Z')).toBe(map)
  })
  it('adds an unknown member', () => {
    expect(advanceLastRead({}, 'b', '2026-09-29T10:00:00Z')).toEqual({ b: '2026-09-29T10:00:00Z' })
  })
})

describe('summariseReceipt', () => {
  it('splits members into read/unread, excluding sender and bot', () => {
    const r = summariseReceipt(
      '2026-09-29T12:00:00Z',
      'coach',
      ['coach', 'p1', 'p2', 'p3', 'bot'],
      { p1: '2026-09-29T12:01:00Z', p2: '2026-09-29T11:00:00Z', bot: '2026-09-29T13:00:00Z' },
      ['bot'],
    )
    expect(r.readBy).toEqual(['p1'])
    expect(r.unreadBy).toEqual(['p2', 'p3'])
  })
})
