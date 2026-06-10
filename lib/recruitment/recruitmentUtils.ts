export type ProspectStatus =
  | 'new'
  | 'reviewing'
  | 'invited'
  | 'trialled'
  | 'offered'
  | 'signed'
  | 'rejected'

export const PROSPECT_STATUSES: ProspectStatus[] = [
  'new',
  'reviewing',
  'invited',
  'trialled',
  'offered',
  'signed',
  'rejected',
]

export const STATUS_META: Record<ProspectStatus, { label: string; badgeClass: string }> = {
  new: { label: 'New', badgeClass: 'bg-blue-100 text-blue-700 border-blue-200' },
  reviewing: { label: 'Reviewing', badgeClass: 'bg-amber-100 text-amber-700 border-amber-200' },
  invited: { label: 'Invited', badgeClass: 'bg-purple-100 text-purple-700 border-purple-200' },
  trialled: { label: 'Trialled', badgeClass: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
  offered: { label: 'Offered', badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  signed: { label: 'Signed', badgeClass: 'bg-green-100 text-green-700 border-green-200' },
  rejected: { label: 'Rejected', badgeClass: 'bg-gray-100 text-gray-600 border-gray-200' },
}

export type ApplicationInput = {
  first_name: string
  last_name: string
  date_of_birth: string
  position?: string
  preferred_foot?: string
  current_club?: string
  contact_email: string
  contact_phone?: string
  parent_guardian_name: string
  consent_given: boolean
  notes?: string
  /** Honeypot field — must be empty. Bots that fill it are rejected. */
  website?: string
}

const NAME_MAX_LENGTH = 80
const EMAIL_MAX_LENGTH = 120
const NOTES_MAX_LENGTH = 1000
const MIN_AGE = 10
const MAX_AGE = 21

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

/**
 * Age in whole years at `today` (defaults to now).
 * Returns null when the date of birth is not a valid date.
 */
export function prospectAge(dateOfBirth: string, today: Date = new Date()): number | null {
  if (!ISO_DATE_REGEX.test(dateOfBirth)) return null

  const dob = new Date(`${dateOfBirth}T00:00:00Z`)
  if (Number.isNaN(dob.getTime())) return null

  // Reject impossible calendar dates that Date silently rolls over (e.g. 2020-02-31)
  if (dob.toISOString().slice(0, 10) !== dateOfBirth) return null

  let age = today.getUTCFullYear() - dob.getUTCFullYear()
  const monthDiff = today.getUTCMonth() - dob.getUTCMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getUTCDate() < dob.getUTCDate())) {
    age -= 1
  }
  return age
}

type ValidationResult = { ok: true } | { ok: false; error: string }

function validateName(value: string, label: string): string | null {
  const trimmed = value.trim()
  if (trimmed.length === 0) return `${label} is required`
  if (trimmed.length > NAME_MAX_LENGTH) {
    return `${label} must be ${NAME_MAX_LENGTH} characters or fewer`
  }
  return null
}

/** Validates a public recruitment application. Returns a generic error for the honeypot. */
export function validateApplication(input: ApplicationInput): ValidationResult {
  // Honeypot: real users never fill this. Keep the error generic so bots learn nothing.
  if (typeof input.website === 'string' && input.website.trim().length > 0) {
    return { ok: false, error: 'Unable to process this application' }
  }

  const nameChecks: Array<[string, string]> = [
    [input.first_name, 'First name'],
    [input.last_name, 'Last name'],
    [input.parent_guardian_name, 'Parent/guardian name'],
  ]
  for (const [value, label] of nameChecks) {
    const error = validateName(typeof value === 'string' ? value : '', label)
    if (error) return { ok: false, error }
  }

  const age = prospectAge(input.date_of_birth)
  if (age === null) {
    return { ok: false, error: 'Date of birth must be a valid date (YYYY-MM-DD)' }
  }
  if (age < 0) {
    return { ok: false, error: 'Date of birth must be in the past' }
  }
  if (age < MIN_AGE || age > MAX_AGE) {
    return { ok: false, error: `Applicants must be between ${MIN_AGE} and ${MAX_AGE} years old` }
  }

  const email = typeof input.contact_email === 'string' ? input.contact_email.trim() : ''
  if (email.length === 0 || email.length > EMAIL_MAX_LENGTH || !EMAIL_REGEX.test(email)) {
    return { ok: false, error: 'A valid contact email is required' }
  }

  if (input.consent_given !== true) {
    return { ok: false, error: 'Parent/guardian consent is required' }
  }

  if (typeof input.notes === 'string' && input.notes.length > NOTES_MAX_LENGTH) {
    return { ok: false, error: `Notes must be ${NOTES_MAX_LENGTH} characters or fewer` }
  }

  return { ok: true }
}
