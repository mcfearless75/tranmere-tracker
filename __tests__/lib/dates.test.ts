import { londonDateISO, londonHour } from '@/lib/dates'

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
