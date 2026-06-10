'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { validateYouthPlayer } from '@/lib/youth/youthUtils'

const inputClass =
  'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900'

export function AddPlayerForm({ squadId }: { squadId: string }) {
  const router = useRouter()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [parentName, setParentName] = useState('')
  const [parentEmail, setParentEmail] = useState('')
  const [parentPhone, setParentPhone] = useState('')
  const [medicalNotes, setMedicalNotes] = useState('')
  const [consent, setConsent] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const validation = validateYouthPlayer({
      first_name: firstName,
      last_name: lastName,
      date_of_birth: dateOfBirth,
      parent_guardian_name: parentName,
      parent_contact_email: parentEmail,
      parent_contact_phone: parentPhone.trim() === '' ? null : parentPhone.trim(),
      medical_notes: medicalNotes.trim() === '' ? null : medicalNotes.trim(),
      consent_given: consent,
    })
    if (!validation.ok) {
      setError(validation.error)
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/youth/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          squad_id: squadId,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          date_of_birth: dateOfBirth,
          parent_guardian_name: parentName.trim(),
          parent_contact_email: parentEmail.trim(),
          parent_contact_phone: parentPhone.trim() === '' ? null : parentPhone.trim(),
          medical_notes: medicalNotes.trim() === '' ? null : medicalNotes.trim(),
          consent_given: consent,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(typeof data.error === 'string' ? data.error : 'Failed to add player.')
        return
      }
      setFirstName('')
      setLastName('')
      setDateOfBirth('')
      setParentName('')
      setParentEmail('')
      setParentPhone('')
      setMedicalNotes('')
      setConsent(false)
      router.refresh()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4">
      <h3 className="text-sm font-bold text-gray-900">Add player</h3>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label htmlFor="player-first-name" className="block text-xs font-semibold text-gray-700">First name</label>
          <input
            id="player-first-name"
            type="text"
            value={firstName}
            onChange={e => setFirstName(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="player-last-name" className="block text-xs font-semibold text-gray-700">Last name</label>
          <input
            id="player-last-name"
            type="text"
            value={lastName}
            onChange={e => setLastName(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="player-dob" className="block text-xs font-semibold text-gray-700">Date of birth</label>
        <input
          id="player-dob"
          type="date"
          value={dateOfBirth}
          onChange={e => setDateOfBirth(e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="player-parent-name" className="block text-xs font-semibold text-gray-700">Parent/guardian name</label>
        <input
          id="player-parent-name"
          type="text"
          value={parentName}
          onChange={e => setParentName(e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="player-parent-email" className="block text-xs font-semibold text-gray-700">Parent/guardian email</label>
        <input
          id="player-parent-email"
          type="email"
          value={parentEmail}
          onChange={e => setParentEmail(e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="player-parent-phone" className="block text-xs font-semibold text-gray-700">Parent/guardian phone (optional)</label>
        <input
          id="player-parent-phone"
          type="tel"
          value={parentPhone}
          onChange={e => setParentPhone(e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="player-medical-notes" className="block text-xs font-semibold text-gray-700">Medical notes (optional)</label>
        <textarea
          id="player-medical-notes"
          value={medicalNotes}
          onChange={e => setMedicalNotes(e.target.value)}
          rows={2}
          className={inputClass}
        />
      </div>

      <label htmlFor="player-consent" className="flex items-start gap-2 text-xs text-gray-700">
        <input
          id="player-consent"
          type="checkbox"
          checked={consent}
          onChange={e => setConsent(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-gray-300"
        />
        <span>
          A parent or guardian has given signed consent for this child to take part and for
          their details to be stored.
        </span>
      </label>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="rounded-xl bg-tranmere-blue px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {saving ? 'Adding…' : 'Add player'}
      </button>
    </form>
  )
}
