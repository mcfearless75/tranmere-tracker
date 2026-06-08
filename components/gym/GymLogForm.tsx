'use client'

import { useState } from 'react'
import { COMMON_EXERCISES } from '@/lib/gym/gymUtils'

interface GymLogFormProps {
  onLogged: () => void
}

export function GymLogForm({ onLogged }: GymLogFormProps) {
  const [exercise, setExercise] = useState('')
  const [customExercise, setCustomExercise] = useState('')
  const [sets, setSets] = useState('')
  const [reps, setReps] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const resolvedExercise = exercise === '__custom__' ? customExercise.trim() : exercise

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!resolvedExercise) {
      setError('Please select or enter an exercise.')
      return
    }
    setSubmitting(true)
    setError('')

    const res = await fetch('/api/gym/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        exercise: resolvedExercise,
        sets: sets ? parseInt(sets, 10) : null,
        reps: reps ? parseInt(reps, 10) : null,
        weight_kg: weightKg ? parseFloat(weightKg) : null,
        notes: notes.trim() || null,
      }),
    })

    if (res.ok) {
      setExercise('')
      setCustomExercise('')
      setSets('')
      setReps('')
      setWeightKg('')
      setNotes('')
      onLogged()
    } else {
      const d = await res.json() as { error?: string }
      setError(d.error ?? 'Something went wrong')
    }
    setSubmitting(false)
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl bg-white border border-gray-200 p-5 space-y-4 shadow-sm">
      <h2 className="text-base font-bold text-tranmere-blue">Log a Lift</h2>

      {/* Exercise selector */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Exercise</label>
        <select
          value={exercise}
          onChange={e => setExercise(e.target.value)}
          className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-tranmere-blue/30"
        >
          <option value="">Select exercise…</option>
          {COMMON_EXERCISES.map(ex => (
            <option key={ex} value={ex}>{ex}</option>
          ))}
          <option value="__custom__">Other (type below)</option>
        </select>
      </div>

      {exercise === '__custom__' && (
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Custom exercise</label>
          <input
            type="text"
            value={customExercise}
            onChange={e => setCustomExercise(e.target.value)}
            placeholder="e.g. Bulgarian Split Squat"
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-tranmere-blue/30"
          />
        </div>
      )}

      {/* Sets / Reps / Weight row */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Sets</label>
          <input
            type="number"
            min={1}
            max={99}
            value={sets}
            onChange={e => setSets(e.target.value)}
            placeholder="3"
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-tranmere-blue/30"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Reps</label>
          <input
            type="number"
            min={1}
            max={999}
            value={reps}
            onChange={e => setReps(e.target.value)}
            placeholder="8"
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-tranmere-blue/30"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Weight (kg)</label>
          <input
            type="number"
            min={0}
            step={0.5}
            value={weightKg}
            onChange={e => setWeightKg(e.target.value)}
            placeholder="80"
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-tranmere-blue/30"
          />
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          placeholder="e.g. paused reps, RPE 8"
          className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-tranmere-blue/30"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting || !resolvedExercise}
        className="w-full py-3 rounded-2xl bg-tranmere-blue text-white text-sm font-bold disabled:opacity-40"
      >
        {submitting ? 'Saving…' : 'Save Lift'}
      </button>
    </form>
  )
}
