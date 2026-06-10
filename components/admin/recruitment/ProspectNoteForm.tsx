'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface ProspectNoteFormProps {
  prospectId: string
}

export function ProspectNoteForm({ prospectId }: ProspectNoteFormProps) {
  const router = useRouter()
  const [noteText, setNoteText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (noteText.trim() === '') {
      setError('Please enter a note.')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/recruitment/prospects/${prospectId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: noteText.trim() }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(typeof data.error === 'string' ? data.error : 'Failed to add note.')
        return
      }
      setNoteText('')
      router.refresh()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <textarea
        value={noteText}
        onChange={e => setNoteText(e.target.value)}
        rows={3}
        placeholder="Add a scouting note…"
        aria-label="Add a scouting note"
        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={saving}
        className="rounded-xl bg-tranmere-blue px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {saving ? 'Adding…' : 'Add note'}
      </button>
    </form>
  )
}
