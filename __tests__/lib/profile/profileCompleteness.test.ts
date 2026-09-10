import { isProfileIncomplete } from '@/lib/profile/profileCompleteness'

const COMPLETE = {
  avatar_url: 'https://example.com/a.jpg',
  date_of_birth: '2008-05-01',
  position: 'Striker',
  height_cm: 175,
  weight_kg: 68,
  build: 'Athletic',
  dominant_foot: 'Right',
}

describe('isProfileIncomplete', () => {
  it('is false when every attribute is filled in', () => {
    expect(isProfileIncomplete(COMPLETE)).toBe(false)
  })

  it('is true when the avatar is missing', () => {
    expect(isProfileIncomplete({ ...COMPLETE, avatar_url: null })).toBe(true)
  })

  it('is true when a numeric field is missing (0 must not be treated as missing)', () => {
    expect(isProfileIncomplete({ ...COMPLETE, height_cm: null })).toBe(true)
    expect(isProfileIncomplete({ ...COMPLETE, height_cm: 0 })).toBe(false)
  })

  it('is true when any single string attribute is missing', () => {
    expect(isProfileIncomplete({ ...COMPLETE, position: null })).toBe(true)
    expect(isProfileIncomplete({ ...COMPLETE, dominant_foot: null })).toBe(true)
  })

  it('is true for a brand-new profile with nothing filled in', () => {
    expect(
      isProfileIncomplete({
        avatar_url: null,
        date_of_birth: null,
        position: null,
        height_cm: null,
        weight_kg: null,
        build: null,
        dominant_foot: null,
      }),
    ).toBe(true)
  })
})
