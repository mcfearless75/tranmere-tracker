export const AGE_GROUPS = [
  'U9', 'U10', 'U11', 'U12', 'U13', 'U14', 'U15', 'U16', 'U17', 'U18',
] as const

export type AgeGroup = (typeof AGE_GROUPS)[number]

export type HomeAway = 'home' | 'away'

export type YouthPlayerInput = {
  first_name: string
  last_name: string
  date_of_birth: string
  parent_guardian_name: string
  parent_contact_email: string
  parent_contact_phone?: string | null
  medical_notes?: string | null
  consent_given: boolean
}

export type ValidationResult = { ok: true } | { ok: false; error: string }

const NAME_MAX_LENGTH = 80
const EMAIL_MAX_LENGTH = 120
const PHONE_MAX_LENGTH = 30
const NOTES_MAX_LENGTH = 1000
const MIN_AGE = 5
const MAX_AGE = 18

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

/** Parses a YYYY-MM-DD string into a UTC Date, rejecting rolled-over dates. */
function parseIsoDate(value: string): Date | null {
  if (!ISO_DATE_REGEX.test(value)) return null
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return null
  // Reject impossible calendar dates that Date silently rolls over (e.g. 2020-02-31)
  if (date.toISOString().slice(0, 10) !== value) return null
  return date
}

/** Age in whole years at `at`. Returns null for an invalid date of birth. */
export function playerAge(dateOfBirth: string, at: Date = new Date()): number | null {
  const dob = parseIsoDate(dateOfBirth)
  if (!dob) return null

  let age = at.getUTCFullYear() - dob.getUTCFullYear()
  const monthDiff = at.getUTCMonth() - dob.getUTCMonth()
  if (monthDiff < 0 || (monthDiff === 0 && at.getUTCDate() < dob.getUTCDate())) {
    age -= 1
  }
  return age
}

/**
 * The season starting year for a given date. English youth football seasons
 * run 1 September to 31 August, so any date up to and including 31 August
 * belongs to the season that started the previous calendar year.
 */
export function seasonStartYearFor(date: Date = new Date()): number {
  // getUTCMonth() is 0-indexed: 8 = September
  return date.getUTCMonth() >= 8 ? date.getUTCFullYear() : date.getUTCFullYear() - 1
}

/**
 * English football age-group rule: a player's age group for a season is
 * their age on 31 August of the season's starting year, plus one.
 * A player aged 11 on 31 August plays Under 12s ('U12') that season.
 * Returns null for invalid dates or ages outside the U9–U18 range.
 */
export function ageGroupFromDob(
  dateOfBirth: string,
  seasonStartYear?: number,
): AgeGroup | null {
  const startYear = seasonStartYear ?? seasonStartYearFor()
  const cutoff = new Date(Date.UTC(startYear, 7, 31)) // 31 August
  const age = playerAge(dateOfBirth, cutoff)
  if (age === null) return null

  const groupNumber = age + 1
  const group = `U${groupNumber}` as AgeGroup
  return AGE_GROUPS.includes(group) ? group : null
}

function validateRequiredName(value: unknown, label: string): string | null {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (trimmed.length === 0) return `${label} is required`
  if (trimmed.length > NAME_MAX_LENGTH) {
    return `${label} must be ${NAME_MAX_LENGTH} characters or fewer`
  }
  return null
}

/**
 * Validates a youth player record. Youth players have no logins, so the
 * parent/guardian name and contact email are mandatory, and signed consent
 * must be recorded before the player is stored.
 */
export function validateYouthPlayer(input: YouthPlayerInput): ValidationResult {
  const nameChecks: Array<[unknown, string]> = [
    [input.first_name, 'First name'],
    [input.last_name, 'Last name'],
    [input.parent_guardian_name, 'Parent/guardian name'],
  ]
  for (const [value, label] of nameChecks) {
    const error = validateRequiredName(value, label)
    if (error) return { ok: false, error }
  }

  const age = playerAge(input.date_of_birth)
  if (age === null) {
    return { ok: false, error: 'Date of birth must be a valid date (YYYY-MM-DD)' }
  }
  if (age < 0) {
    return { ok: false, error: 'Date of birth must be in the past' }
  }
  if (age < MIN_AGE || age > MAX_AGE) {
    return { ok: false, error: `Youth players must be between ${MIN_AGE} and ${MAX_AGE} years old` }
  }

  const email =
    typeof input.parent_contact_email === 'string' ? input.parent_contact_email.trim() : ''
  if (email.length === 0 || email.length > EMAIL_MAX_LENGTH || !EMAIL_REGEX.test(email)) {
    return { ok: false, error: 'A valid parent/guardian contact email is required' }
  }

  if (
    typeof input.parent_contact_phone === 'string' &&
    input.parent_contact_phone.trim().length > PHONE_MAX_LENGTH
  ) {
    return { ok: false, error: `Contact phone must be ${PHONE_MAX_LENGTH} characters or fewer` }
  }

  if (typeof input.medical_notes === 'string' && input.medical_notes.length > NOTES_MAX_LENGTH) {
    return { ok: false, error: `Medical notes must be ${NOTES_MAX_LENGTH} characters or fewer` }
  }

  if (input.consent_given !== true) {
    return { ok: false, error: 'Parent/guardian consent is required' }
  }

  return { ok: true }
}

/**
 * Result label from the squad's perspective.
 * result_home / result_away are the home and away team scores; home_away
 * says which side the squad played, so an away side winning 2-0 reads 'W 2-0'.
 * Returns null when the fixture is unplayed (either score missing).
 */
export function fixtureResultLabel(
  homeAway: HomeAway,
  resultHome: number | null,
  resultAway: number | null,
): string | null {
  if (resultHome === null || resultAway === null) return null

  const ours = homeAway === 'home' ? resultHome : resultAway
  const theirs = homeAway === 'home' ? resultAway : resultHome

  const outcome = ours > theirs ? 'W' : ours < theirs ? 'L' : 'D'
  return `${outcome} ${ours}-${theirs}`
}
