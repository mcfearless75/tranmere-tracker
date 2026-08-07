import { londonDateISO, londonHour, londonWallTimeToUTC } from '@/lib/dates'

describe('londonDateISO', () => {
  it('returns the London calendar date, not the UTC date, during BST', () => {
    // 23:30 UTC on 1 July = 00:30 on 2 July in London (BST = UTC+1)
    expect(londonDateISO(new Date('2026-07-01T23:30:00Z'))).toBe('2026-07-02')
  })

  it('matches the UTC date during GMT', () => {
    expect(londonDateISO(new Date('2026-01-15T23:30:00Z'))).toBe('2026-01-15')
  })

  it('formats as YYYY-MM-DD', () => {
    expect(londonDateISO(new Date('2026-08-07T10:00:00Z'))).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('londonHour', () => {
  it('resolves the 08:00 UTC cron run to 9 during BST (am phase)', () => {
    expect(londonHour(new Date('2026-08-07T08:00:00Z'))).toBe(9)
  })

  it('resolves the 15:00 UTC cron run to 16 during BST (pm phase)', () => {
    expect(londonHour(new Date('2026-08-07T15:00:00Z'))).toBe(16)
  })

  it('resolves 08:00 UTC to 8 during GMT', () => {
    expect(londonHour(new Date('2026-01-07T08:00:00Z'))).toBe(8)
  })

  it('returns 0 at London midnight (h23 cycle, never 24)', () => {
    expect(londonHour(new Date('2026-01-07T00:00:00Z'))).toBe(0)
  })
})

describe('londonWallTimeToUTC', () => {
  it('converts a 09:00 London slot to 08:00 UTC during BST', () => {
    expect(londonWallTimeToUTC('2026-08-10', '09:00').toISOString()).toBe('2026-08-10T08:00:00.000Z')
  })

  it('converts a 09:00 London slot to 09:00 UTC during GMT', () => {
    expect(londonWallTimeToUTC('2026-01-12', '09:00').toISOString()).toBe('2026-01-12T09:00:00.000Z')
  })

  it('accepts HH:MM:SS (Postgres time format)', () => {
    expect(londonWallTimeToUTC('2026-08-10', '14:30:00').toISOString()).toBe('2026-08-10T13:30:00.000Z')
  })

  it('keeps the London calendar date for early-morning slots during BST', () => {
    // 00:30 London on 10 Aug = 23:30 UTC on 9 Aug — the previous naive
    // .toISOString().split("T")[0] approach would shift scheduled_date.
    expect(londonWallTimeToUTC('2026-08-10', '00:30').toISOString()).toBe('2026-08-09T23:30:00.000Z')
  })

  it('handles the spring-forward day (BST starts 29 Mar 2026, 01:00 UTC)', () => {
    // 09:00 London on transition day is already BST → 08:00 UTC
    expect(londonWallTimeToUTC('2026-03-29', '09:00').toISOString()).toBe('2026-03-29T08:00:00.000Z')
    // 00:30 London on transition day is still GMT → 00:30 UTC
    expect(londonWallTimeToUTC('2026-03-29', '00:30').toISOString()).toBe('2026-03-29T00:30:00.000Z')
  })

  it('handles the autumn fall-back day (GMT resumes 25 Oct 2026)', () => {
    expect(londonWallTimeToUTC('2026-10-25', '09:00').toISOString()).toBe('2026-10-25T09:00:00.000Z')
    expect(londonWallTimeToUTC('2026-10-25', '00:30').toISOString()).toBe('2026-10-24T23:30:00.000Z')
  })
})
