'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'

type MatchEvent = {
  id: string
  match_date: string
  opponent: string
  location: string | null
  status: string
}
type Invitation = {
  id: string
  status: string
  coach_rating: number | null
  position: string | null
  match_events: MatchEvent | null
}

export function MatchInvitations({ invitations }: { invitations: Invitation[] }) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)

  const pending = invitations.filter(i => i.status === 'invited')
  const past = invitations.filter(i => i.status !== 'invited')

  async function respond(squadId: string, status: 'accepted' | 'declined') {
    setLoading(squadId)
    const supabase = createClient()
    await supabase.from('match_squads').update({ status }).eq('id', squadId)
    setLoading(null)
    router.refresh()
  }

  return (
    <div className="space-y-3">
      {pending.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
          <p className="font-semibold text-amber-800 text-sm">⚽ Squad Invitations</p>
          {pending.map(inv => (
            <div key={inv.id} className="bg-white rounded-lg p-3 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1">
                <p className="font-medium">vs {inv.match_events?.opponent}</p>
                <p className="text-xs text-muted-foreground">
                  {inv.match_events?.match_date
                    ? new Date(inv.match_events.match_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
                    : ''}
                  {inv.match_events?.location && ` · ${inv.match_events.location}`}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => respond(inv.id, 'accepted')}
                  disabled={loading === inv.id}
                  className="flex-1 sm:flex-none bg-green-600 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  Accept
                </button>
                <button
                  onClick={() => respond(inv.id, 'declined')}
                  disabled={loading === inv.id}
                  className="flex-1 sm:flex-none bg-red-100 text-red-700 text-sm px-4 py-1.5 rounded-lg hover:bg-red-200 disabled:opacity-50"
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {past.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-muted-foreground">Coach-assigned matches</p>
          {past.map(inv => (
            <div key={inv.id} className="bg-white border rounded-xl p-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">vs {inv.match_events?.opponent}</p>
                <p className="text-xs text-muted-foreground">
                  {inv.match_events?.match_date
                    ? new Date(inv.match_events.match_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                    : ''}
                  {inv.position && ` · ${inv.position}`}
                </p>
              </div>
              <div className="text-right">
                {inv.coach_rating && (
                  <p className="text-lg font-bold text-tranmere-blue">{inv.coach_rating}<span className="text-xs text-muted-foreground">/10</span></p>
                )}
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  inv.status === 'accepted' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                }`}>
                  {inv.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
