'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle, XCircle, Clock, ExternalLink } from 'lucide-react'
import Link from 'next/link'

type Squad = {
  id: string
  player_id: string
  status: string
  coach_rating: number | null
  position: string | null
  users: { name: string } | null
}
type Match = {
  id: string
  match_date: string
  opponent: string
  location: string | null
  status: string
  notes: string | null
  match_squads: Squad[]
}

const statusIcon = (s: string) =>
  s === 'accepted' ? <CheckCircle size={14} className="text-green-500" /> :
  s === 'declined' ? <XCircle size={14} className="text-red-400" /> :
  <Clock size={14} className="text-amber-400" />

export function MatchEventList({ matches }: { matches: Match[] }) {
  const router = useRouter()
  const [ratings, setRatings] = useState<Record<string, number>>({})
  const [positions, setPositions] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)

  async function saveRating(squadId: string) {
    setSaving(squadId)
    const supabase = createClient()
    await supabase.from('match_squads').update({
      coach_rating: ratings[squadId] ?? null,
      position: positions[squadId] ?? null,
    }).eq('id', squadId)
    setSaving(null)
    router.refresh()
  }

  async function markComplete(matchId: string) {
    const supabase = createClient()
    await supabase.from('match_events').update({ status: 'completed' }).eq('id', matchId)
    router.refresh()
  }

  if (matches.length === 0) return null

  const today = new Date().toISOString().split('T')[0]
  const upcoming = matches.filter(m => m.match_date >= today || m.status === 'upcoming')
  const past = matches.filter(m => m.match_date < today && m.status !== 'upcoming')

  function renderMatch(m: Match) {
    return (
      <div key={m.id} className="bg-white rounded-xl border p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <Link href={`/admin/match-events/${m.id}`} className="font-semibold text-tranmere-blue hover:underline inline-flex items-center gap-1">
              vs {m.opponent}
              <ExternalLink size={12} className="opacity-60" />
            </Link>
            <p className="text-sm text-muted-foreground">
              {new Date(m.match_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
              {m.location && ` · ${m.location}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
              m.status === 'completed' ? 'bg-green-100 text-green-700' :
              m.status === 'cancelled' ? 'bg-red-100 text-red-600' :
              'bg-amber-100 text-amber-700'
            }`}>
              {m.status}
            </span>
            {m.status === 'upcoming' && (
              <button
                onClick={() => markComplete(m.id)}
                className="text-xs text-tranmere-blue underline"
              >
                Mark complete
              </button>
            )}
          </div>
        </div>

        {m.match_squads.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b">
                <th className="pb-1">Player</th>
                <th className="pb-1">Response</th>
                <th className="pb-1">Position</th>
                <th className="pb-1">Rating</th>
                {m.status === 'completed' && <th className="pb-1"></th>}
              </tr>
            </thead>
            <tbody>
              {m.match_squads.map(sq => (
                <tr key={sq.id} className="border-b last:border-0">
                  <td className="py-1.5">{sq.users?.name ?? '—'}</td>
                  <td className="py-1.5">
                    <span className="flex items-center gap-1">
                      {statusIcon(sq.status)}
                      <span className="capitalize text-xs">{sq.status}</span>
                    </span>
                  </td>
                  <td className="py-1.5">
                    {m.status === 'completed' ? (
                      <input
                        className="border rounded px-2 py-0.5 text-xs w-24"
                        placeholder="Position"
                        defaultValue={sq.position ?? ''}
                        onChange={e => setPositions(p => ({ ...p, [sq.id]: e.target.value }))}
                      />
                    ) : (sq.position ?? '—')}
                  </td>
                  <td className="py-1.5">
                    {m.status === 'completed' ? (
                      <select
                        className="border rounded px-2 py-0.5 text-xs"
                        defaultValue={sq.coach_rating ?? ''}
                        onChange={e => setRatings(r => ({ ...r, [sq.id]: Number(e.target.value) }))}
                      >
                        <option value="">—</option>
                        {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    ) : (sq.coach_rating ? `${sq.coach_rating}/10` : '—')}
                  </td>
                  {m.status === 'completed' && (
                    <td className="py-1.5">
                      <button
                        onClick={() => saveRating(sq.id)}
                        disabled={saving === sq.id}
                        className="text-xs text-tranmere-blue underline disabled:opacity-50"
                      >
                        {saving === sq.id ? 'Saving…' : 'Save'}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {upcoming.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
            Upcoming Fixtures
            <span className="text-sm font-normal text-muted-foreground">({upcoming.length})</span>
          </h2>
          {upcoming.map(renderMatch)}
        </div>
      )}

      {past.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-gray-400" />
            Past Matches
            <span className="text-sm font-normal text-muted-foreground">({past.length})</span>
          </h2>
          {past.map(renderMatch)}
        </div>
      )}
    </div>
  )
}
