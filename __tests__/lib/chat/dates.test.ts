import { dayLabel, londonDayKey, needsDayDivider, formatClock } from '@/lib/chat/dates'

// Tue 29 Sep 2026, 13:20 BST
const NOW = new Date('2026-09-29T12:20:00Z')

describe('londonDayKey', () => {
  it('uses the London calendar day, not UTC', () => {
    // 23:30 UTC on 28 Sep is 00:30 BST on 29 Sep
    expect(londonDayKey('2026-09-28T23:30:00Z')).toBe('2026-09-29')
  })
})

describe('dayLabel', () => {
  it('labels today and yesterday', () => {
    expect(dayLabel('2026-09-29T07:00:00Z', NOW)).toBe('Today')
    expect(dayLabel('2026-09-28T17:46:00Z', NOW)).toBe('Yesterday')
  })
  it('treats just-after-midnight BST as today', () => {
    expect(dayLabel('2026-09-28T23:30:00Z', NOW)).toBe('Today')
  })
  it('uses the weekday within the last week', () => {
    expect(dayLabel('2026-09-25T12:00:00Z', NOW)).toBe('Friday')
  })
  it('uses a short date for older messages this year', () => {
    expect(dayLabel('2026-09-12T12:00:00Z', NOW)).toBe('Sat 12 Sept')
  })
  it('includes the year for previous years', () => {
    expect(dayLabel('2025-12-12T12:00:00Z', NOW)).toBe('12 Dec 2025')
  })
})

describe('needsDayDivider', () => {
  it('always divides before the first message', () => {
    expect(needsDayDivider(undefined, '2026-09-29T12:00:00Z')).toBe(true)
  })
  it('divides only when the London day changes', () => {
    expect(needsDayDivider('2026-09-29T08:00:00Z', '2026-09-29T12:00:00Z')).toBe(false)
    expect(needsDayDivider('2026-09-28T22:00:00Z', '2026-09-28T23:30:00Z')).toBe(true)
  })
})

describe('formatClock', () => {
  it('formats London HH:MM', () => {
    expect(formatClock('2026-09-29T11:32:00Z')).toBe('12:32')
  })
})
