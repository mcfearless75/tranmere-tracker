'use client'

import { useState, useCallback } from 'react'
import { DAILY_GOAL_ML, progressPct, intakeLabel } from '@/lib/hydration/hydrationUtils'

const QUICK_ADD_OPTIONS = [
  { label: '+250ml', value: 250 },
  { label: '+330ml', value: 330 },
  { label: '+500ml', value: 500 },
  { label: '+750ml', value: 750 },
]

interface HydrationTrackerProps {
  initialTotalMl: number
}

export function HydrationTracker({ initialTotalMl }: HydrationTrackerProps) {
  const [totalMl, setTotalMl] = useState(initialTotalMl)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refetchTotal = useCallback(async () => {
    const res = await fetch('/api/hydration/today')
    if (res.ok) {
      const json = await res.json() as { total_ml: number }
      setTotalMl(json.total_ml)
    }
  }, [])

  const handleAdd = useCallback(async (amount_ml: number) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/hydration/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount_ml }),
      })
      if (!res.ok) {
        const json = await res.json() as { error?: string }
        throw new Error(json.error ?? 'Failed to log intake')
      }
      await refetchTotal()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [refetchTotal])

  const pct = progressPct(totalMl, DAILY_GOAL_ML)
  const label = intakeLabel(totalMl, DAILY_GOAL_ML)

  return (
    <div className="bg-white rounded-xl border p-4 space-y-4">
      <h2 className="text-base font-semibold text-tranmere-blue">Hydration</h2>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-sm text-gray-600">
          <span>{label}</span>
          <span className="font-medium text-tranmere-blue">{pct}%</span>
        </div>
        <div className="h-3 rounded-full bg-blue-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-tranmere-blue transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Quick-add buttons */}
      <div className="flex gap-2 flex-wrap">
        {QUICK_ADD_OPTIONS.map(({ label: btnLabel, value }) => (
          <button
            key={value}
            onClick={() => handleAdd(value)}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg border border-tranmere-blue text-tranmere-blue text-sm font-medium
                       hover:bg-tranmere-blue hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {btnLabel}
          </button>
        ))}
      </div>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {pct >= 100 && (
        <p className="text-sm font-medium text-green-600">Daily goal reached!</p>
      )}
    </div>
  )
}
