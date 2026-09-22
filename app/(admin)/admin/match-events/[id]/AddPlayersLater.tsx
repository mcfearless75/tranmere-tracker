'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { TeamBadge } from '@/components/TeamBadge'
import { sortByTeamFirst } from '@/lib/teams/players'
import type { TeamRef } from '@/lib/teams/types'

export function AddPlayersLater({
  matchId,
  opponent,
  matchTeamId,
  available,
}: {
  matchId: string
  opponent: string
  matchTeamId: string | null
  available: { id: string; name: string; team_id: string | null; teams: TeamRef | null }[]
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function add() {
    if (selected.size === 0) return
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('match_squads').insert(
      Array.from(selected).map(player_id => ({ match_id: matchId, player_id, status: 'invited' })),
    )
    setSaving(false)
    if (error) setMsg(error.message)
    else {
      void fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Match squad',
          body: `You've been added to the squad vs ${opponent}`,
          targetUserIds: Array.from(selected),
          url: '/matches',
        }),
      }).catch(() => {})
      setSelected(new Set())
      setMsg(`Invited ${selected.size}`)
      router.refresh()
    }
  }

  if (available.length === 0) return null

  const ordered = sortByTeamFirst(available, matchTeamId)

  return (
    <div className="bg-white rounded-xl border p-4 space-y-3">
      <p className="font-semibold text-sm">Add players later</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
        {ordered.map(s => (
          <button
            key={s.id}
            type="button"
            onClick={() => toggle(s.id)}
            className={`flex items-center justify-between gap-1.5 text-sm px-3 py-2 rounded-lg border text-left ${
              selected.has(s.id) ? 'bg-tranmere-blue text-white border-tranmere-blue' : 'border-gray-200'
            }`}
          >
            <span className="truncate">{s.name}</span>
            <TeamBadge team={s.teams} />
          </button>
        ))}
      </div>
      <Button type="button" onClick={add} disabled={saving || selected.size === 0} className="bg-tranmere-blue text-white">
        {saving ? 'Adding…' : `Invite ${selected.size || ''}`.trim()}
      </Button>
      {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
    </div>
  )
}
