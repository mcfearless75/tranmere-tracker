'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { GoalCategory, GoalPriority, StudentGoal } from '@/lib/goals/goalsUtils'
import { PlusCircle, CheckCircle2 } from 'lucide-react'

const CATEGORY_LABELS: Record<GoalCategory, string> = {
  personal: 'Personal',
  academic: 'Academic',
  football: 'Football',
  fitness: 'Fitness',
}

const PRIORITY_LABELS: Record<GoalPriority, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

interface GoalFormProps {
  activeGoals: StudentGoal[]
}

export default function GoalForm({ activeGoals }: GoalFormProps) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<GoalCategory>('personal')
  const [priority, setPriority] = useState<GoalPriority>('medium')
  const [description, setDescription] = useState('')
  const [deadline, setDeadline] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [completing, setCompleting] = useState<string | null>(null)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    const res = await fetch('/api/goals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        category,
        priority,
        description: description || undefined,
        deadline: deadline || undefined,
      }),
    })

    if (res.ok) {
      setTitle('')
      setDescription('')
      setDeadline('')
      setCategory('personal')
      setPriority('medium')
      setShowForm(false)
      router.refresh()
    } else {
      const d = await res.json() as { error?: string }
      setError(d.error ?? 'Something went wrong')
    }
    setSubmitting(false)
  }

  async function handleMarkComplete(goalId: string) {
    setCompleting(goalId)
    const res = await fetch(`/api/goals/${goalId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    })
    setCompleting(null)
    if (res.ok) {
      router.refresh()
    }
  }

  return (
    <div className="space-y-4">
      {/* Active goal mark-complete buttons */}
      {activeGoals.length > 0 && (
        <div className="space-y-2">
          {activeGoals.map(goal => (
            <div
              key={goal.id}
              className="flex items-center justify-between rounded-xl bg-white border border-gray-200 px-4 py-3 shadow-sm"
            >
              <span className="text-sm font-medium text-gray-800 truncate">{goal.title}</span>
              <button
                onClick={() => handleMarkComplete(goal.id)}
                disabled={completing === goal.id}
                className="ml-3 flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg disabled:opacity-40 shrink-0"
              >
                <CheckCircle2 size={13} />
                {completing === goal.id ? 'Saving…' : 'Mark complete'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add goal toggle */}
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-tranmere-blue/30 text-tranmere-blue text-sm font-semibold hover:border-tranmere-blue/60 hover:bg-blue-50 transition-colors"
        >
          <PlusCircle size={16} />
          Add new goal
        </button>
      ) : (
        <form
          onSubmit={handleCreate}
          className="rounded-2xl bg-white border border-gray-200 p-5 shadow-sm space-y-4"
        >
          <h2 className="text-base font-bold text-tranmere-blue">New Goal</h2>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Improve first touch"
              className="w-full text-sm rounded-xl border border-gray-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-tranmere-blue/30"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as GoalCategory)}
                className="w-full text-sm rounded-xl border border-gray-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-tranmere-blue/30 bg-white"
              >
                {(Object.keys(CATEGORY_LABELS) as GoalCategory[]).map(c => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Priority <span className="text-red-500">*</span>
              </label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as GoalPriority)}
                className="w-full text-sm rounded-xl border border-gray-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-tranmere-blue/30 bg-white"
              >
                {(Object.keys(PRIORITY_LABELS) as GoalPriority[]).map(p => (
                  <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              Deadline (optional)
            </label>
            <input
              type="date"
              value={deadline}
              onChange={e => setDeadline(e.target.value)}
              className="w-full text-sm rounded-xl border border-gray-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-tranmere-blue/30"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What does success look like?"
              rows={2}
              className="w-full text-sm rounded-xl border border-gray-200 px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-tranmere-blue/30"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => { setShowForm(false); setError('') }}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 rounded-xl bg-tranmere-blue text-white text-sm font-bold disabled:opacity-40"
            >
              {submitting ? 'Saving…' : 'Save Goal'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
