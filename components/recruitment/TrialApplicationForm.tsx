'use client'

import { useState } from 'react'
import { validateApplication, type ApplicationInput } from '@/lib/recruitment/recruitmentUtils'

const POSITIONS = [
  'Goalkeeper',
  'Defender',
  'Midfielder',
  'Forward',
] as const

const inputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-tranmere-blue focus:outline-none focus:ring-1 focus:ring-tranmere-blue'

const labelClass = 'block text-sm font-medium text-gray-700 mb-1'

type SubmitState = 'idle' | 'submitting' | 'success' | 'error'

export function TrialApplicationForm() {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [position, setPosition] = useState('')
  const [preferredFoot, setPreferredFoot] = useState('')
  const [currentClub, setCurrentClub] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [parentGuardianName, setParentGuardianName] = useState('')
  const [consentGiven, setConsentGiven] = useState(false)
  const [notes, setNotes] = useState('')
  const [website, setWebsite] = useState('') // honeypot — humans never see or fill this
  const [submitState, setSubmitState] = useState<SubmitState>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')

    const application: ApplicationInput = {
      first_name: firstName,
      last_name: lastName,
      date_of_birth: dateOfBirth,
      position: position || undefined,
      preferred_foot: preferredFoot || undefined,
      current_club: currentClub || undefined,
      contact_email: contactEmail,
      contact_phone: contactPhone || undefined,
      parent_guardian_name: parentGuardianName,
      consent_given: consentGiven,
      notes: notes || undefined,
      website,
    }

    const validation = validateApplication(application)
    if (!validation.ok) {
      setErrorMessage(validation.error)
      setSubmitState('error')
      return
    }

    setSubmitState('submitting')
    try {
      const res = await fetch('/api/recruitment/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(application),
      })
      const json: { success?: boolean; error?: string } = await res.json()
      if (!res.ok || !json.success) {
        setErrorMessage(json.error ?? 'Something went wrong. Please try again.')
        setSubmitState('error')
        return
      }
      setSubmitState('success')
    } catch {
      setErrorMessage('Something went wrong. Please check your connection and try again.')
      setSubmitState('error')
    }
  }

  if (submitState === 'success') {
    return (
      <div
        role="status"
        className="rounded-xl border border-green-200 bg-green-50 px-4 py-6 text-center"
      >
        <p className="text-base font-semibold text-green-800">
          Application received — we&apos;ll be in touch
        </p>
        <p className="mt-1 text-sm text-green-700">
          Our recruitment team will review your application and contact you about the next trial date.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="trial-first-name" className={labelClass}>
            First name
          </label>
          <input
            id="trial-first-name"
            type="text"
            required
            maxLength={80}
            autoComplete="given-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="trial-last-name" className={labelClass}>
            Last name
          </label>
          <input
            id="trial-last-name"
            type="text"
            required
            maxLength={80}
            autoComplete="family-name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor="trial-dob" className={labelClass}>
          Date of birth
        </label>
        <input
          id="trial-dob"
          type="date"
          required
          value={dateOfBirth}
          onChange={(e) => setDateOfBirth(e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="trial-position" className={labelClass}>
            Position <span className="text-gray-400">(optional)</span>
          </label>
          <select
            id="trial-position"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            className={inputClass}
          >
            <option value="">Select a position</option>
            {POSITIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="trial-foot" className={labelClass}>
            Preferred foot <span className="text-gray-400">(optional)</span>
          </label>
          <select
            id="trial-foot"
            value={preferredFoot}
            onChange={(e) => setPreferredFoot(e.target.value)}
            className={inputClass}
          >
            <option value="">Select preferred foot</option>
            <option value="left">Left</option>
            <option value="right">Right</option>
            <option value="both">Both</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="trial-club" className={labelClass}>
          Current club <span className="text-gray-400">(optional)</span>
        </label>
        <input
          id="trial-club"
          type="text"
          maxLength={120}
          value={currentClub}
          onChange={(e) => setCurrentClub(e.target.value)}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="trial-email" className={labelClass}>
          Contact email
        </label>
        <input
          id="trial-email"
          type="email"
          required
          maxLength={120}
          autoComplete="email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="trial-phone" className={labelClass}>
          Contact phone <span className="text-gray-400">(optional)</span>
        </label>
        <input
          id="trial-phone"
          type="tel"
          maxLength={30}
          autoComplete="tel"
          value={contactPhone}
          onChange={(e) => setContactPhone(e.target.value)}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="trial-guardian" className={labelClass}>
          Parent/guardian name
        </label>
        <input
          id="trial-guardian"
          type="text"
          required
          maxLength={80}
          value={parentGuardianName}
          onChange={(e) => setParentGuardianName(e.target.value)}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="trial-notes" className={labelClass}>
          Anything else we should know? <span className="text-gray-400">(optional)</span>
        </label>
        <textarea
          id="trial-notes"
          rows={3}
          maxLength={1000}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={inputClass}
        />
      </div>

      {/* Honeypot — hidden from humans, bots tend to fill every field */}
      <div aria-hidden="true" className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden">
        <label htmlFor="trial-website">Website</label>
        <input
          id="trial-website"
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      <label className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
        <input
          type="checkbox"
          required
          checked={consentGiven}
          onChange={(e) => setConsentGiven(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-tranmere-blue focus:ring-tranmere-blue"
        />
        <span className="text-sm text-gray-700">
          I confirm I am the parent/guardian or have their consent for this application, and for the
          Academy to contact us about trials.
        </span>
      </label>

      {submitState === 'error' && errorMessage && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <button
        type="submit"
        disabled={submitState === 'submitting'}
        className="w-full rounded-xl bg-tranmere-blue px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitState === 'submitting' ? 'Submitting…' : 'Submit application'}
      </button>
    </form>
  )
}
