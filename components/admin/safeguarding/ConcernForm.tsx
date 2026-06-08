'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ConcernCategory,
  ConcernSeverity,
  CONCERN_CATEGORIES,
  CONCERN_SEVERITIES,
  CATEGORY_LABELS,
  SEVERITY_LABELS,
} from '@/lib/safeguarding/safeguardingUtils'

interface StudentOption {
  id: string
  name: string
}

interface ConcernFormProps {
  students: StudentOption[]
  defaultStudentId?: string
}

export function ConcernForm({ students, defaultStudentId }: ConcernFormProps) {
  const router = useRouter()
  const [studentId, setStudentId] = useState(defaultStudentId ?? '')
  const [category, setCategory] = useState<ConcernCategory>('wellbeing')
  const [severity, setSeverity] = useState<ConcernSeverity>('medium')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!studentId) {
      setError('Please select a student.')
      return
    }
    if (description.trim() === '') {
      setError('Please enter a description.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/safeguarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          category,
          severity,
          description: description.trim(),
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(typeof data.error === 'string' ? data.error : 'Failed to create concern.')
        return
      }

      const { concern } = await res.json()
      router.push(`/admin/safeguarding/${concern.id}`)
      router.refresh()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="student" className="mb-1 block text-sm font-medium text-gray-900">Student</label>
        <select
          id="student"
          value={studentId}
          onChange={e => setStudentId(e.target.value)}
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900"
          required
        >
          <option value="">Select a student…</option>
          {students.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="category" className="mb-1 block text-sm font-medium text-gray-900">Category</label>
          <select
            id="category"
            value={category}
            onChange={e => setCategory(e.target.value as ConcernCategory)}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900"
          >
            {CONCERN_CATEGORIES.map(c => (
              <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="severity" className="mb-1 block text-sm font-medium text-gray-900">Severity</label>
          <select
            id="severity"
            value={severity}
            onChange={e => setSeverity(e.target.value as ConcernSeverity)}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900"
          >
            {CONCERN_SEVERITIES.map(s => (
              <option key={s} value={s}>{SEVERITY_LABELS[s]}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="description" className="mb-1 block text-sm font-medium text-gray-900">Description</label>
        <textarea
          id="description"
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={5}
          placeholder="Describe the concern, what was observed, and any immediate actions taken…"
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900"
          required
        />
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-tranmere-blue px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {submitting ? 'Saving…' : 'Log concern'}
      </button>
    </form>
  )
}
