'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'

export function IdpForm() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (!title.trim()) {
      setError('Title is required')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/idp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          target_date: targetDate || null,
        }),
      })

      if (!res.ok) {
        const json = await res.json() as { error?: string }
        setError(json.error ?? 'Something went wrong')
        return
      }

      setTitle('')
      setDescription('')
      setTargetDate('')
      router.refresh()
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl bg-white border border-gray-200 p-5 shadow-sm space-y-4">
      <h2 className="text-sm font-bold text-gray-700">Add New Plan</h2>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="space-y-1">
        <label htmlFor="idp-title" className="text-xs font-semibold text-gray-600">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          id="idp-title"
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="e.g. Improve first touch"
          required
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tranmere-blue/40"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="idp-description" className="text-xs font-semibold text-gray-600">
          Description
        </label>
        <textarea
          id="idp-description"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Steps, notes, or context..."
          rows={3}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tranmere-blue/40 resize-none"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="idp-target-date" className="text-xs font-semibold text-gray-600">
          Target Date
        </label>
        <input
          id="idp-target-date"
          type="date"
          value={targetDate}
          onChange={e => setTargetDate(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tranmere-blue/40"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-tranmere-blue text-white font-semibold text-sm py-2.5 hover:bg-tranmere-blue/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Saving...' : 'Add Plan'}
      </button>
    </form>
  )
}
