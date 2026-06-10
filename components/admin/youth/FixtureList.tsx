'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { fixtureResultLabel } from '@/lib/youth/youthUtils'
import { YouthFixtureRow } from './types'

function formatDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function resultBadgeClass(label: string): string {
  if (label.startsWith('W')) return 'border-green-200 bg-green-100 text-green-700'
  if (label.startsWith('L')) return 'border-red-200 bg-red-100 text-red-700'
  return 'border-amber-200 bg-amber-100 text-amber-700'
}

function RecordResultForm({ fixture, onDone }: { fixture: YouthFixtureRow; onDone: () => void }) {
  const router = useRouter()
  const [homeScore, setHomeScore] = useState('')
  const [awayScore, setAwayScore] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const home = Number(homeScore)
    const away = Number(awayScore)
    if (homeScore === '' || awayScore === '' || !Number.isInteger(home) || !Number.isInteger(away) || home < 0 || away < 0) {
      setError('Enter both scores as whole numbers.')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/youth/fixtures/${fixture.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result_home: home, result_away: away }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(typeof data.error === 'string' ? data.error : 'Failed to record result.')
        return
      }
      onDone()
      router.refresh()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-2 border-t border-gray-100 pt-3">
      <div className="flex items-center gap-2">
        <label htmlFor={`home-score-${fixture.id}`} className="sr-only">Home score</label>
        <input
          id={`home-score-${fixture.id}`}
          type="number"
          min={0}
          max={99}
          value={homeScore}
          onChange={e => setHomeScore(e.target.value)}
          placeholder="Home"
          className="w-20 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
        />
        <span className="text-sm text-gray-500">–</span>
        <label htmlFor={`away-score-${fixture.id}`} className="sr-only">Away score</label>
        <input
          id={`away-score-${fixture.id}`}
          type="number"
          min={0}
          max={99}
          value={awayScore}
          onChange={e => setAwayScore(e.target.value)}
          placeholder="Away"
          className="w-20 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
        />
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-tranmere-blue px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">Home score first, regardless of venue.</p>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </form>
  )
}

export function FixtureList({ fixtures }: { fixtures: YouthFixtureRow[] }) {
  const [recordingId, setRecordingId] = useState<string | null>(null)

  if (fixtures.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center text-sm text-muted-foreground">
        No fixtures yet. Add the first one below.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {fixtures.map(fixture => {
        const label = fixtureResultLabel(fixture.home_away, fixture.result_home, fixture.result_away)
        return (
          <div key={fixture.id} className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-gray-900">
                  {fixture.home_away === 'home' ? 'vs' : 'at'} {fixture.opponent}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {formatDate(fixture.fixture_date)}
                  {fixture.kick_off ? `, ${fixture.kick_off.slice(0, 5)}` : ''}
                  {fixture.location ? ` · ${fixture.location}` : ''}
                </p>
              </div>
              {label ? (
                <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-bold ${resultBadgeClass(label)}`}>
                  {label}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setRecordingId(recordingId === fixture.id ? null : fixture.id)}
                  className="shrink-0 rounded-xl border border-tranmere-blue px-3 py-1.5 text-xs font-semibold text-tranmere-blue"
                >
                  {recordingId === fixture.id ? 'Cancel' : 'Record result'}
                </button>
              )}
            </div>
            {fixture.notes && <p className="mt-2 text-xs text-gray-700">{fixture.notes}</p>}
            {recordingId === fixture.id && !label && (
              <RecordResultForm fixture={fixture} onDone={() => setRecordingId(null)} />
            )}
          </div>
        )
      })}
    </div>
  )
}
