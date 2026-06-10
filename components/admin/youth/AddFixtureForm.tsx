'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { HomeAway } from '@/lib/youth/youthUtils'

const inputClass =
  'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900'

export function AddFixtureForm({ squadId }: { squadId: string }) {
  const router = useRouter()
  const [opponent, setOpponent] = useState('')
  const [fixtureDate, setFixtureDate] = useState('')
  const [kickOff, setKickOff] = useState('')
  const [location, setLocation] = useState('')
  const [homeAway, setHomeAway] = useState<HomeAway>('home')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (opponent.trim() === '') {
      setError('Please enter an opponent.')
      return
    }
    if (fixtureDate === '') {
      setError('Please choose a fixture date.')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/youth/fixtures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          squad_id: squadId,
          opponent: opponent.trim(),
          fixture_date: fixtureDate,
          kick_off: kickOff === '' ? null : kickOff,
          location: location.trim() === '' ? null : location.trim(),
          home_away: homeAway,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(typeof data.error === 'string' ? data.error : 'Failed to add fixture.')
        return
      }
      setOpponent('')
      setFixtureDate('')
      setKickOff('')
      setLocation('')
      setHomeAway('home')
      router.refresh()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4">
      <h3 className="text-sm font-bold text-gray-900">Add fixture</h3>

      <div className="space-y-1">
        <label htmlFor="fixture-opponent" className="block text-xs font-semibold text-gray-700">Opponent</label>
        <input
          id="fixture-opponent"
          type="text"
          value={opponent}
          onChange={e => setOpponent(e.target.value)}
          placeholder="e.g. Everton Juniors"
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label htmlFor="fixture-date" className="block text-xs font-semibold text-gray-700">Date</label>
          <input
            id="fixture-date"
            type="date"
            value={fixtureDate}
            onChange={e => setFixtureDate(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="fixture-kick-off" className="block text-xs font-semibold text-gray-700">Kick-off (optional)</label>
          <input
            id="fixture-kick-off"
            type="time"
            value={kickOff}
            onChange={e => setKickOff(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="fixture-location" className="block text-xs font-semibold text-gray-700">Location (optional)</label>
        <input
          id="fixture-location"
          type="text"
          value={location}
          onChange={e => setLocation(e.target.value)}
          placeholder="e.g. Solar Campus"
          className={inputClass}
        />
      </div>

      <fieldset className="space-y-1">
        <legend className="block text-xs font-semibold text-gray-700">Venue</legend>
        <div className="flex gap-2">
          {(['home', 'away'] as HomeAway[]).map(option => (
            <button
              key={option}
              type="button"
              onClick={() => setHomeAway(option)}
              className={`rounded-xl border px-4 py-2 text-sm font-semibold capitalize ${
                homeAway === option
                  ? 'border-tranmere-blue bg-tranmere-blue text-white'
                  : 'border-gray-200 bg-white text-gray-700'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </fieldset>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="rounded-xl bg-tranmere-blue px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {saving ? 'Adding…' : 'Add fixture'}
      </button>
    </form>
  )
}
