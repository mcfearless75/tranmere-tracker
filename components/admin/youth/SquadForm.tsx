'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AGE_GROUPS } from '@/lib/youth/youthUtils'
import { CoachOption } from './types'

export function SquadForm({ coaches }: { coaches: CoachOption[] }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [ageGroup, setAgeGroup] = useState<string>('U12')
  const [coachId, setCoachId] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (name.trim() === '') {
      setError('Please enter a squad name.')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/youth/squads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          age_group: ageGroup,
          coach_id: coachId === '' ? null : coachId,
          notes: notes.trim() === '' ? null : notes.trim(),
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(typeof data.error === 'string' ? data.error : 'Failed to create squad.')
        return
      }
      setName('')
      setAgeGroup('U12')
      setCoachId('')
      setNotes('')
      router.refresh()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4">
      <h2 className="text-sm font-bold text-gray-900">New squad</h2>

      <div className="space-y-1">
        <label htmlFor="squad-name" className="block text-xs font-semibold text-gray-700">Name</label>
        <input
          id="squad-name"
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Under 12s"
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label htmlFor="squad-age-group" className="block text-xs font-semibold text-gray-700">Age group</label>
          <select
            id="squad-age-group"
            value={ageGroup}
            onChange={e => setAgeGroup(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900"
          >
            {AGE_GROUPS.map(group => (
              <option key={group} value={group}>{group}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="squad-coach" className="block text-xs font-semibold text-gray-700">Coach (optional)</label>
          <select
            id="squad-coach"
            value={coachId}
            onChange={e => setCoachId(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900"
          >
            <option value="">Unassigned</option>
            {coaches.map(coach => (
              <option key={coach.id} value={coach.id}>{coach.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="squad-notes" className="block text-xs font-semibold text-gray-700">Notes (optional)</label>
        <textarea
          id="squad-notes"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900"
        />
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="rounded-xl bg-tranmere-blue px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {saving ? 'Creating…' : 'Create squad'}
      </button>
    </form>
  )
}
