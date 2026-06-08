import {
  getCurrentTerm,
  isTermStartMonth,
  termAlreadyExists,
} from '@/lib/reviews/scheduleUtils'

describe('getCurrentTerm', () => {
  it('returns Autumn YYYY for September', () => {
    expect(getCurrentTerm(new Date('2026-09-01'))).toBe('Autumn 2026')
  })

  it('returns Autumn YYYY for October', () => {
    expect(getCurrentTerm(new Date('2026-10-15'))).toBe('Autumn 2026')
  })

  it('returns Autumn YYYY for November', () => {
    expect(getCurrentTerm(new Date('2026-11-30'))).toBe('Autumn 2026')
  })

  it('returns Autumn YYYY for December', () => {
    expect(getCurrentTerm(new Date('2026-12-25'))).toBe('Autumn 2026')
  })

  it('returns Spring YYYY for January', () => {
    expect(getCurrentTerm(new Date('2026-01-01'))).toBe('Spring 2026')
  })

  it('returns Spring YYYY for February', () => {
    expect(getCurrentTerm(new Date('2026-02-14'))).toBe('Spring 2026')
  })

  it('returns Spring YYYY for March', () => {
    expect(getCurrentTerm(new Date('2026-03-20'))).toBe('Spring 2026')
  })

  it('returns Spring YYYY for April', () => {
    expect(getCurrentTerm(new Date('2026-04-30'))).toBe('Spring 2026')
  })

  it('returns Summer YYYY for May', () => {
    expect(getCurrentTerm(new Date('2026-05-01'))).toBe('Summer 2026')
  })

  it('returns Summer YYYY for June', () => {
    expect(getCurrentTerm(new Date('2026-06-08'))).toBe('Summer 2026')
  })

  it('returns Summer YYYY for July', () => {
    expect(getCurrentTerm(new Date('2026-07-04'))).toBe('Summer 2026')
  })

  it('returns Summer YYYY for August', () => {
    expect(getCurrentTerm(new Date('2026-08-31'))).toBe('Summer 2026')
  })
})

describe('isTermStartMonth', () => {
  it('returns true for September (month 8)', () => {
    expect(isTermStartMonth(8)).toBe(true)
  })

  it('returns true for January (month 0)', () => {
    expect(isTermStartMonth(0)).toBe(true)
  })

  it('returns true for April (month 3)', () => {
    expect(isTermStartMonth(3)).toBe(true)
  })

  it('returns false for October (month 9)', () => {
    expect(isTermStartMonth(9)).toBe(false)
  })

  it('returns false for February (month 1)', () => {
    expect(isTermStartMonth(1)).toBe(false)
  })

  it('returns false for June (month 5)', () => {
    expect(isTermStartMonth(5)).toBe(false)
  })

  it('returns false for December (month 11)', () => {
    expect(isTermStartMonth(11)).toBe(false)
  })
})

describe('termAlreadyExists', () => {
  const reviews = [
    { term: 'Autumn 2025' },
    { term: 'Spring 2026' },
  ]

  it('returns true when the term label matches an existing record', () => {
    expect(termAlreadyExists(reviews, 'Spring 2026')).toBe(true)
  })

  it('returns false when the term label does not match any record', () => {
    expect(termAlreadyExists(reviews, 'Summer 2026')).toBe(false)
  })

  it('returns false for an empty reviews array', () => {
    expect(termAlreadyExists([], 'Autumn 2026')).toBe(false)
  })

  it('is case-sensitive', () => {
    expect(termAlreadyExists(reviews, 'autumn 2025')).toBe(false)
  })
})
