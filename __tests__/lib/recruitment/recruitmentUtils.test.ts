import {
  validateApplication,
  prospectAge,
  PROSPECT_STATUSES,
  STATUS_META,
  ApplicationInput,
} from '@/lib/recruitment/recruitmentUtils'

function makeApplication(overrides: Partial<ApplicationInput> = {}): ApplicationInput {
  return {
    first_name: 'Jamie',
    last_name: 'Carragher',
    date_of_birth: '2012-03-15',
    position: 'Centre back',
    preferred_foot: 'right',
    current_club: 'Local FC',
    contact_email: 'parent@example.com',
    contact_phone: '07123456789',
    parent_guardian_name: 'Pat Carragher',
    consent_given: true,
    notes: 'Plays Sunday league.',
    ...overrides,
  }
}

function expectError(input: ApplicationInput): string {
  const result = validateApplication(input)
  expect(result.ok).toBe(false)
  if (result.ok) throw new Error('expected validation failure')
  return result.error
}

describe('validateApplication', () => {
  it('accepts a fully valid application', () => {
    expect(validateApplication(makeApplication())).toEqual({ ok: true })
  })

  it('accepts an application with optional fields omitted', () => {
    expect(
      validateApplication(
        makeApplication({
          position: undefined,
          preferred_foot: undefined,
          current_club: undefined,
          contact_phone: undefined,
          notes: undefined,
          website: undefined,
        }),
      ),
    ).toEqual({ ok: true })
  })

  describe('required names', () => {
    const nameCases: Array<{
      name: string
      label: string
      override: (value: string) => Partial<ApplicationInput>
    }> = [
      { name: 'first_name', label: 'First name', override: value => ({ first_name: value }) },
      { name: 'last_name', label: 'Last name', override: value => ({ last_name: value }) },
      {
        name: 'parent_guardian_name',
        label: 'Parent/guardian name',
        override: value => ({ parent_guardian_name: value }),
      },
    ]

    it.each(nameCases)('rejects empty $name', ({ label, override }) => {
      expect(expectError(makeApplication(override('')))).toContain(label)
    })

    it.each(nameCases)('rejects whitespace-only $name', ({ override }) => {
      expect(validateApplication(makeApplication(override('   '))).ok).toBe(false)
    })

    it.each(nameCases)('rejects $name over 80 characters', ({ override }) => {
      const result = validateApplication(makeApplication(override('a'.repeat(81))))
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error).toContain('80')
    })

    it('accepts names at exactly 80 characters', () => {
      expect(validateApplication(makeApplication({ first_name: 'a'.repeat(80) }))).toEqual({
        ok: true,
      })
    })
  })

  describe('date_of_birth', () => {
    it('rejects a malformed date string', () => {
      expect(expectError(makeApplication({ date_of_birth: 'not-a-date' }))).toContain('valid date')
    })

    it('rejects an impossible calendar date', () => {
      expect(validateApplication(makeApplication({ date_of_birth: '2012-02-31' })).ok).toBe(false)
    })

    it('rejects an empty date', () => {
      expect(validateApplication(makeApplication({ date_of_birth: '' })).ok).toBe(false)
    })

    it('rejects a future date of birth', () => {
      const nextYear = new Date().getUTCFullYear() + 2
      expect(
        validateApplication(makeApplication({ date_of_birth: `${nextYear}-01-01` })).ok,
      ).toBe(false)
    })

    it('rejects an applicant younger than 10', () => {
      const dob = new Date()
      dob.setUTCFullYear(dob.getUTCFullYear() - 8)
      const dobString = dob.toISOString().slice(0, 10)
      expect(expectError(makeApplication({ date_of_birth: dobString }))).toContain('10')
    })

    it('rejects an applicant older than 21', () => {
      expect(expectError(makeApplication({ date_of_birth: '1990-01-01' }))).toContain('21')
    })

    it('accepts an applicant aged exactly 10', () => {
      const dob = new Date()
      dob.setUTCFullYear(dob.getUTCFullYear() - 10)
      dob.setUTCDate(dob.getUTCDate() - 1)
      const dobString = dob.toISOString().slice(0, 10)
      expect(validateApplication(makeApplication({ date_of_birth: dobString }))).toEqual({
        ok: true,
      })
    })

    it('accepts an applicant aged 21 (not yet 22)', () => {
      const dob = new Date()
      dob.setUTCFullYear(dob.getUTCFullYear() - 22)
      dob.setUTCDate(dob.getUTCDate() + 2)
      const dobString = dob.toISOString().slice(0, 10)
      expect(validateApplication(makeApplication({ date_of_birth: dobString }))).toEqual({
        ok: true,
      })
    })
  })

  describe('contact_email', () => {
    it.each(['', 'no-at-sign', 'missing@tld', 'spaces in@email.com', '@example.com'])(
      'rejects invalid email %p',
      email => {
        expect(expectError(makeApplication({ contact_email: email }))).toContain('email')
      },
    )

    it('rejects an email over 120 characters', () => {
      const longEmail = `${'a'.repeat(115)}@ex.com`
      expect(validateApplication(makeApplication({ contact_email: longEmail })).ok).toBe(false)
    })

    it('accepts a valid email with surrounding whitespace', () => {
      expect(
        validateApplication(makeApplication({ contact_email: '  parent@example.com  ' })),
      ).toEqual({ ok: true })
    })
  })

  describe('consent_given', () => {
    it('rejects when consent is not given', () => {
      expect(expectError(makeApplication({ consent_given: false }))).toContain('consent')
    })
  })

  describe('honeypot', () => {
    it('rejects with a generic error when website is filled', () => {
      const error = expectError(makeApplication({ website: 'https://spam.example' }))
      expect(error).toBe('Unable to process this application')
      expect(error).not.toContain('honeypot')
      expect(error).not.toContain('website')
    })

    it('accepts when website is an empty string', () => {
      expect(validateApplication(makeApplication({ website: '' }))).toEqual({ ok: true })
    })

    it('accepts when website is whitespace only', () => {
      expect(validateApplication(makeApplication({ website: '   ' }))).toEqual({ ok: true })
    })
  })

  describe('notes', () => {
    it('rejects notes over 1000 characters', () => {
      expect(expectError(makeApplication({ notes: 'x'.repeat(1001) }))).toContain('1000')
    })

    it('accepts notes at exactly 1000 characters', () => {
      expect(validateApplication(makeApplication({ notes: 'x'.repeat(1000) }))).toEqual({
        ok: true,
      })
    })
  })
})

describe('prospectAge', () => {
  it('computes age when the birthday has passed this year', () => {
    expect(prospectAge('2010-01-15', new Date('2026-06-10T00:00:00Z'))).toBe(16)
  })

  it('computes age when the birthday is still to come this year', () => {
    expect(prospectAge('2010-12-25', new Date('2026-06-10T00:00:00Z'))).toBe(15)
  })

  it('counts the birthday itself as already turned', () => {
    expect(prospectAge('2010-06-10', new Date('2026-06-10T00:00:00Z'))).toBe(16)
  })

  it('returns the day before the birthday as the younger age', () => {
    expect(prospectAge('2010-06-11', new Date('2026-06-10T00:00:00Z'))).toBe(15)
  })

  it('returns a negative age for a future date of birth', () => {
    expect(prospectAge('2030-01-01', new Date('2026-06-10T00:00:00Z'))).toBe(-4)
  })

  it('returns null for a malformed string', () => {
    expect(prospectAge('15/03/2012')).toBeNull()
    expect(prospectAge('not-a-date')).toBeNull()
    expect(prospectAge('')).toBeNull()
  })

  it('returns null for an impossible calendar date', () => {
    expect(prospectAge('2012-02-31')).toBeNull()
    expect(prospectAge('2012-13-01')).toBeNull()
  })
})

describe('PROSPECT_STATUSES and STATUS_META', () => {
  it('lists all seven statuses in pipeline order', () => {
    expect(PROSPECT_STATUSES).toEqual([
      'new',
      'reviewing',
      'invited',
      'trialled',
      'offered',
      'signed',
      'rejected',
    ])
  })

  it('has meta with a non-empty label and badgeClass for every status', () => {
    for (const status of PROSPECT_STATUSES) {
      expect(STATUS_META[status].label.length).toBeGreaterThan(0)
      expect(STATUS_META[status].badgeClass.length).toBeGreaterThan(0)
    }
  })

  it('has no extra keys beyond the contracted statuses', () => {
    expect(Object.keys(STATUS_META).sort()).toEqual([...PROSPECT_STATUSES].sort())
  })
})
