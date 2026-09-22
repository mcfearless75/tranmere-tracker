'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import type { Team } from '@/lib/teams/types'

export function MatchEditForm({ match, teams }: {
  match: {
    id: string
    match_date: string
    kick_off_time?: string | null
    meet_time?: string | null
    opponent: string
    location: string | null
    notes: string | null
    status: string
    team_id: string | null
  }
  teams: Team[]
}) {
  const router = useRouter()
  const [date, setDate] = useState(match.match_date?.slice(0, 10) ?? '')
  const [kickOffTime, setKickOffTime] = useState((match.kick_off_time ?? '').slice(0, 5))
  const [meetTime, setMeetTime] = useState((match.meet_time ?? '').slice(0, 5))
  const [opponent, setOpponent] = useState(match.opponent)
  const [location, setLocation] = useState(match.location ?? '')
  const [notes, setNotes] = useState(match.notes ?? '')
  const [status, setStatus] = useState(match.status)
  const [teamId, setTeamId] = useState(match.team_id ?? '')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setMsg(null)
    const supabase = createClient()
    const patch: Record<string, unknown> = {
      match_date: date,
      kick_off_time: kickOffTime || null,
      opponent,
      location: location || null,
      notes: notes || null,
      status,
      // The only place a fixture's team could be set was at creation
      // (CreateMatchForm) — a wrong pick, or "set it later", meant deleting
      // and re-creating the fixture, which drops match_squads and re-sends
      // every squad-invite push. null, not '', for "no team" — team_id is a
      // nullable FK and an empty string is a different (wrong) value.
      team_id: teamId || null,
    }
    if (meetTime) patch.meet_time = meetTime
    const { error } = await supabase.from('match_events').update(patch).eq('id', match.id)
    setSaving(false)
    if (error) setMsg(error.message.includes('meet_time') ? 'Run 075 SQL in Supabase for meet time.' : error.message)
    else {
      setMsg('Saved')
      router.refresh()
    }
  }

  return (
    <div className="bg-white rounded-xl border p-4 space-y-3">
      <p className="font-semibold text-sm">Edit fixture</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Date</label>
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Meet time</label>
          <Input type="time" value={meetTime} onChange={e => setMeetTime(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Kick-off</label>
          <Input type="time" value={kickOffTime} onChange={e => setKickOffTime(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Status</label>
          <select value={status} onChange={e => setStatus(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="upcoming">Upcoming</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="edit-match-team" className="text-xs text-muted-foreground">Team</label>
          <select
            id="edit-match-team"
            value={teamId}
            onChange={e => setTeamId(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          >
            <option value="">No team</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div className="space-y-1 col-span-2">
          <label className="text-xs text-muted-foreground">Opponent</label>
          <Input value={opponent} onChange={e => setOpponent(e.target.value)} />
        </div>
        <div className="space-y-1 col-span-2">
          <label className="text-xs text-muted-foreground">Location</label>
          <Input value={location} onChange={e => setLocation(e.target.value)} />
        </div>
      </div>
      <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="resize-none" placeholder="Notes" />
      <div className="flex items-center gap-3">
        <Button type="button" onClick={save} disabled={saving || !date || !opponent} className="bg-tranmere-blue text-white">
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
        {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
      </div>
    </div>
  )
}
