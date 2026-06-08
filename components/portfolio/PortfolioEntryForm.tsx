'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ENTRY_TYPE_LABELS,
  VALID_ENTRY_TYPES,
  parseTags,
} from '@/lib/portfolio/portfolioUtils'
import type { EntryType } from '@/lib/portfolio/portfolioUtils'

export default function PortfolioEntryForm() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [entryType, setEntryType] = useState<EntryType>('achievement')
  const [description, setDescription] = useState('')
  const [tagsRaw, setTagsRaw] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (!title.trim()) {
      setError('Title is required.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          entry_type: entryType,
          description: description.trim() || undefined,
          tags: parseTags(tagsRaw),
        }),
      })

      if (!res.ok) {
        const json = await res.json() as { error?: string }
        setError(json.error ?? 'Something went wrong.')
        return
      }

      setTitle('')
      setEntryType('achievement')
      setDescription('')
      setTagsRaw('')
      router.refresh()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4"
    >
      <h2 className="text-base font-semibold text-gray-900">Add Portfolio Entry</h2>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div>
        <label htmlFor="pf-title" className="block text-sm font-medium text-gray-700 mb-1">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          id="pf-title"
          type="text"
          required
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="e.g. Led warm-up session"
        />
      </div>

      <div>
        <label htmlFor="pf-type" className="block text-sm font-medium text-gray-700 mb-1">
          Type
        </label>
        <select
          id="pf-type"
          value={entryType}
          onChange={e => setEntryType(e.target.value as EntryType)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {VALID_ENTRY_TYPES.map(type => (
            <option key={type} value={type}>
              {ENTRY_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="pf-description" className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          id="pf-description"
          rows={3}
          value={description}
          onChange={e => setDescription(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          placeholder="What did you do or learn?"
        />
      </div>

      <div>
        <label htmlFor="pf-tags" className="block text-sm font-medium text-gray-700 mb-1">
          Tags <span className="text-gray-400 font-normal">(comma-separated)</span>
        </label>
        <input
          id="pf-tags"
          type="text"
          value={tagsRaw}
          onChange={e => setTagsRaw(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="e.g. leadership, teamwork"
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {submitting ? 'Saving…' : 'Add Entry'}
      </button>
    </form>
  )
}
