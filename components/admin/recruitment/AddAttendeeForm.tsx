'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export type ProspectOption = {
  id: string
  name: string
}

interface AddAttendeeFormProps {
  trialEventId: string
  options: ProspectOption[]
}

export function AddAttendeeForm({ trialEventId, options }: AddAttendeeFormProps) {
  const router = useRouter()
  const [prospectId, setProspectId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (prospectId === '') {
      setError('Please choose a prospect.')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/recruitment/trials/${trialEventId}/attendees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospect_id: prospectId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(typeof data.error === 'string' ? data.error : 'Failed to add attendee.')
        return
      }
      setProspectId('')
      router.refresh()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (options.length === 0) {
    return <p className="text-sm text-muted-foreground">All prospects are already on this trial.</p>
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 rounded-2xl border border-gray-200 bg-white p-4">
      <label htmlFor="add-attendee" className="block text-sm font-semibold text-gray-900">
        Add prospect to trial
      </label>
      <select
        id="add-attendee"
        value={prospectId}
        onChange={e => setProspectId(e.target.value)}
        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900"
      >
        <option value="">Choose a prospect…</option>
        {options.map(o => (
          <option key={o.id} value={o.id}>{o.name}</option>
        ))}
      </select>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={saving}
        className="rounded-xl bg-tranmere-blue px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {saving ? 'Adding…' : 'Add attendee'}
      </button>
    </form>
  )
}
