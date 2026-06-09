'use client'

import { useState } from 'react'
import { Sparkles, Printer, AlertCircle } from 'lucide-react'

type Cohort = 'all' | 'year1' | 'year2'

const COHORTS: { value: Cohort; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'year1', label: 'Year 1' },
  { value: 'year2', label: 'Year 2' },
]

type ReportResult = {
  summary: string
  cohort: Cohort
  generated_at: string
}

/** Renders markdown-ish summary text: section headings (## or **bold**) get emphasis. */
function SummaryBody({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <div className="space-y-1.5 text-sm leading-relaxed text-gray-800">
      {lines.map((line, i) => {
        const heading = line.match(/^#{1,6}\s+(.*)$/)
        if (heading) {
          return (
            <h3 key={i} className="font-bold text-tranmere-blue text-base mt-4 first:mt-0">
              {heading[1]}
            </h3>
          )
        }
        if (line.trim() === '') return <div key={i} className="h-1" />
        const bold = line.match(/^\*\*(.+)\*\*:?\s*$/)
        if (bold) {
          return <p key={i} className="font-semibold text-gray-900 mt-3">{bold[1]}</p>
        }
        return <p key={i} className="whitespace-pre-wrap">{line.replace(/^[-*]\s+/, '• ')}</p>
      })}
    </div>
  )
}

export function CohortReportClient() {
  const [cohort, setCohort] = useState<Cohort>('all')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ReportResult | null>(null)

  async function generate() {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/ai/cohort-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cohort }),
      })
      const data = (await res.json()) as Partial<ReportResult> & { error?: string }
      if (!res.ok) {
        setError(data.error ?? 'Failed to generate report.')
        return
      }
      if (!data.summary || !data.generated_at) {
        setError('The report came back empty. Please try again.')
        return
      }
      setResult({ summary: data.summary, cohort, generated_at: data.generated_at })
    } catch {
      setError('Network error — could not reach the report service.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* CONTROLS */}
      <div className="rounded-2xl border bg-white p-5 shadow-sm print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-600">Cohort</span>
            <div className="flex rounded-lg bg-gray-100 p-0.5 text-sm">
              {COHORTS.map(c => (
                <button
                  key={c.value}
                  onClick={() => setCohort(c.value)}
                  className={`rounded-md px-3 py-1 font-medium transition ${
                    cohort === c.value ? 'bg-white text-tranmere-blue shadow-sm' : 'text-gray-500'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={generate}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-600 text-white px-4 py-2 text-sm font-semibold shadow-md hover:opacity-90 disabled:opacity-60 transition"
          >
            <Sparkles size={15} />
            {loading ? 'Generating…' : 'Generate report'}
          </button>
        </div>
      </div>

      {/* ERROR */}
      {error && (
        <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 print:hidden">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* RESULT */}
      {result && (
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3 mb-4">
            <div>
              <p className="font-bold text-tranmere-blue">
                {COHORTS.find(c => c.value === result.cohort)?.label} cohort — executive summary
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Generated {new Date(result.generated_at).toLocaleString('en-GB', { timeZone: 'Europe/London' })}
              </p>
            </div>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-tranmere-blue text-white px-3 py-1.5 text-sm font-medium hover:bg-blue-900 print:hidden"
            >
              <Printer size={14} /> Print / Save PDF
            </button>
          </div>
          <SummaryBody text={result.summary} />
        </div>
      )}

      {!result && !loading && !error && (
        <p className="text-sm text-muted-foreground">
          Pick a cohort and generate a Claude-written summary across attendance, GPS, wellbeing and match form.
        </p>
      )}
    </div>
  )
}
