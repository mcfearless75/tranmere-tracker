import {
  ageGroupFromDob,
  fixtureResultLabel,
  playerAge,
  seasonStartYearFor,
  validateYouthPlayer,
  YouthPlayerInput,
} from '@/lib/youth/youthUtils'

describe('seasonStartYearFor', () => {
  it('uses the current year from 1 September', () => {
    expect(seasonStartYearFor(new Date('2025-09-01T00:00:00Z'))).toBe(2025)
  })

  it('uses the previous year up to and including 31 August', () => {
    expect(seasonStartYearFor(new Date('2025-08-31T23:59:59Z'))).toBe(2024)
  })

  it('uses the previous year mid-season', () => {
    expect(seasonStartYearFor(new Date('2026-06-10T12:00:00Z'))).toBe(2025)
  })
})

describe('ageGroupFromDob', () => {
  // Season 2025/26: age group determined by age on 31 August 2025

  it('puts a player aged 11 on 31 August into U12', () => {
    expect(ageGroupFromDob('2014-08-31', 2025)).toBe('U12')
  })

  it('puts a player who turns 11 on 1 September into U11 (boundary)', () => {
    expect(ageGroupFromDob('2014-09-01', 2025)).toBe('U11')
  })

  it('returns U9 for the youngest eligible group', () => {
    expect(ageGroupFromDob('2017-08-31', 2025)).toBe('U9')
  })

  it('returns U18 for the oldest eligible group', () => {
    expect(ageGroupFromDob('2008-08-31', 2025)).toBe('U18')
  })

  it('returns null below U9', () => {
    expect(ageGroupFromDob('2018-09-01', 2025)).toBeNull()
  })

  it('returns null above U18', () => {
    expect(ageGroupFromDob('2007-08-31', 2025)).toBeNull()
  })

  it('returns null for an invalid date', () => {
    expect(ageGroupFromDob('not-a-date', 2025)).toBeNull()
    expect(ageGroupFromDob('2014-02-31', 2025)).toBeNull()
  })
})

describe('playerAge', () => {
  it('computes whole years at a reference date', () => {
    expect(playerAge('2014-06-15', new Date('2026-06-14T00:00:00Z'))).toBe(11)
    expect(playerAge('2014-06-15', new Date('2026-06-15T00:00:00Z'))).toBe(12)
  })

  it('returns null for invalid input', () => {
    expect(playerAge('15/06/2014')).toBeNull()
  })
})

describe('validateYouthPlayer', () => {
  function dobYearsAgo(years: number): string {
    return `${new Date().getUTCFullYear() - years}-01-01`
  }

  function validInput(overrides: Partial<YouthPlayerInput> = {}): YouthPlayerInput {
    return {
      first_name: 'Sam',
      last_name: 'Jones',
      date_of_birth: dobYearsAgo(10),
      parent_guardian_name: 'Alex Jones',
      parent_contact_email: 'alex.jones@example.com',
      parent_contact_phone: '0151 000 0000',
      medical_notes: null,
      consent_given: true,
      ...overrides,
    }
  }

  it('accepts a fully valid player', () => {
    expect(validateYouthPlayer(validInput())).toEqual({ ok: true })
  })

  it('rejects a missing first name', () => {
    const result = validateYouthPlayer(validInput({ first_name: '  ' }))
    expect(result).toEqual({ ok: false, error: 'First name is required' })
  })

  it('rejects a missing parent/guardian name', () => {
    const result = validateYouthPlayer(validInput({ parent_guardian_name: '' }))
    expect(result.ok).toBe(false)
  })

  it('rejects names over the length cap', () => {
    const result = validateYouthPlayer(validInput({ last_name: 'x'.repeat(81) }))
    expect(result.ok).toBe(false)
  })

  it('rejects an invalid date of birth', () => {
    const result = validateYouthPlayer(validInput({ date_of_birth: '2014-13-01' }))
    expect(result.ok).toBe(false)
  })

  it('rejects a future date of birth', () => {
    const futureYear = new Date().getUTCFullYear() + 2
    const result = validateYouthPlayer(validInput({ date_of_birth: `${futureYear}-01-01` }))
    expect(result.ok).toBe(false)
  })

  it('rejects players younger than 5', () => {
    const result = validateYouthPlayer(validInput({ date_of_birth: dobYearsAgo(3) }))
    expect(result.ok).toBe(false)
  })

  it('rejects players older than 18', () => {
    const result = validateYouthPlayer(validInput({ date_of_birth: dobYearsAgo(25) }))
    expect(result.ok).toBe(false)
  })

  it('rejects an invalid parent contact email', () => {
    const result = validateYouthPlayer(validInput({ parent_contact_email: 'not-an-email' }))
    expect(result).toEqual({ ok: false, error: 'A valid parent/guardian contact email is required' })
  })

  it('rejects when consent has not been given', () => {
    const result = validateYouthPlayer(validInput({ consent_given: false }))
    expect(result).toEqual({ ok: false, error: 'Parent/guardian consent is required' })
  })

  it('rejects oversized medical notes', () => {
    const result = validateYouthPlayer(validInput({ medical_notes: 'x'.repeat(1001) }))
    expect(result.ok).toBe(false)
  })

  it('accepts a player with no phone or medical notes', () => {
    const result = validateYouthPlayer(
      validInput({ parent_contact_phone: null, medical_notes: null }),
    )
    expect(result).toEqual({ ok: true })
  })
})

describe('fixtureResultLabel', () => {
  it('labels a home win with our score first', () => {
    expect(fixtureResultLabel('home', 3, 1)).toBe('W 3-1')
  })

  it('labels a home loss', () => {
    expect(fixtureResultLabel('home', 0, 2)).toBe('L 0-2')
  })

  it('labels a draw', () => {
    expect(fixtureResultLabel('home', 1, 1)).toBe('D 1-1')
  })

  it('labels an away win from our perspective', () => {
    // We were the away side and won 2-0, so the label reads W 2-0
    expect(fixtureResultLabel('away', 0, 2)).toBe('W 2-0')
  })

  it('labels an away loss from our perspective', () => {
    expect(fixtureResultLabel('away', 3, 1)).toBe('L 1-3')
  })

  it('labels an away draw', () => {
    expect(fixtureResultLabel('away', 2, 2)).toBe('D 2-2')
  })

  it('returns null when the fixture is unplayed', () => {
    expect(fixtureResultLabel('home', null, null)).toBeNull()
    expect(fixtureResultLabel('home', 1, null)).toBeNull()
    expect(fixtureResultLabel('away', null, 1)).toBeNull()
  })
})
