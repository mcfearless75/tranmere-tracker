'use client'

import { useState } from 'react'
import { Sparkles, RefreshCw } from 'lucide-react'

export function AiInsights({ studentId, studentName }: { studentId: string; studentName: string }) {
  const [loading, setLoading] = useState(false)
  const [insights, setInsights] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function generate() {
    setLoading(true)
    setError(null)
    const res = await fetch('/api/ai/student-insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId }),
    })
    const data = await res.json()
    setLoading(false)
    if (data.error) setError(data.error)
    else setInsights(data.insights)
  }

  return (
    <div className="rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50 via-white to-indigo-50 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h2 className="font-semibold flex items-center gap-1.5 text-purple-900">
          <Sparkles size={16} /> AI Insights
        </h2>
        {insights && (
          <button
            onClick={generate}
            disabled={loading}
            className="text-xs text-purple-700 font-medium flex items-center gap-1 hover:underline disabled:opacity-50"
          >
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} /> Regenerate
          </button>
        )}
      </div>

      {!insights && !loading && !error && (
        <button
          onClick={generate}
          className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2.5 text-sm font-semibold shadow hover:shadow-lg"
        >
          <Sparkles size={14} className="inline mr-1.5" />
          Generate insights for {studentName.split(' ')[0]}
        </button>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm text-purple-700 py-2">
          <Sparkles size={14} className="animate-pulse" /> Claude is reading the data…
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {insights && (
        <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
          {insights}
        </div>
      )}
    </div>
  )
}
