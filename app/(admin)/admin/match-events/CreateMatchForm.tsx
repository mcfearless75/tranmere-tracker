'use client'
import { YearBadge } from '@/components/YearBadge'
import { TeamBadge } from '@/components/TeamBadge'
import type { Team, TeamRef } from '@/lib/teams/types'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { formatEventTime } from '@/lib/calendar/calendarUtils'

type Student = {
  id: string
  name: string
  year_group: number
  role: string
  team_id: string | null
  teams: TeamRef | null
}
type Props = { students: Student[]; teams: Team[]; coachId: string }

/**
 * Hoisted to module scope so it keeps a stable function identity across
 * CreateMatchForm's re-renders (every keystroke in Date/Opponent/Location/
 * Notes re-renders the form). A component declared inside another
 * component's render body gets a new type on every render, which makes
 * React unmount + remount the whole player grid — real, avoidable churn on
 * a phone with dozens of players. Everything it needs comes in as props.
 */
type PlayerButtonProps = {
  student: Student
  selected: boolean
  onToggle: (id: string) => void
  /** Show the team badge — true for a mixed-team list (Other players / no
   * team chosen), false inside a single chosen team's own roster where
   * every tile is the same team and the badge would be redundant. */
  showTeam: boolean
}

function PlayerButton({ student, selected, onToggle, showTeam }: PlayerButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onToggle(student.id)}
      className={`text-sm px-3 py-2 rounded-lg border text-left ${
        selected
          ? 'bg-tranmere-blue text-white border-tranmere-blue'
          : 'bg-white text-gray-700 border-gray-200'
      }`}
    >
      <span className="flex items-center justify-between gap-1.5">
        <span className="truncate">{student.name}</span>
        <span className="flex items-center gap-1 shrink-0">
          {showTeam && <TeamBadge team={student.teams} />}
          <YearBadge year={student.year_group} />
        </span>
      </span>
    </button>
  )
}

/** True when both sets contain exactly the same ids. */
function sameSelection(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false
  for (const id of a) if (!b.has(id)) return false
  return true
}

export function CreateMatchForm({ students, teams, coachId }: Props) {
  const router = useRouter()
  const [date, setDate] = useState('')
  const [kickOffTime, setKickOffTime] = useState('')
  const [meetTime, setMeetTime] = useState('')
  const [opponent, setOpponent] = useState('')
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [teamId, setTeamId] = useState<string>('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  /** The set the given team id would pre-fill — empty for '' (no team). */
  function prefillFor(id: string): Set<string> {
    return id ? new Set(students.filter(s => s.team_id === id).map(s => s.id)) : new Set()
  }

  function pickTeam(next: string) {
    // "Manual work" is anything the coach's current selection holds beyond
    // (or short of) exactly what the CURRENT team would pre-fill — covers
    // blank+manual-picks, a call-up added on top of a team, and a player
    // unticked from a team, not just "no team is selected yet". Comparing
    // teamId === '' alone (the original brief's guard) misses every
    // team-to-team switch, which is silent data loss for the call-up
    // workflow this feature exists to support.
    const hasManualWork = !sameSelection(selected, prefillFor(teamId))
    if (hasManualWork && !confirm('Replace the players you have picked with the whole team?')) return
    setTeamId(next)
    setSelected(prefillFor(next))
  }

  async function handleCreate() {
    if (!date || !opponent) { setMessage({ text: 'Date and opponent required', ok: false }); return }
    setSaving(true)
    setMessage(null)
    const supabase = createClient()

    const row: Record<string, unknown> = {
      coach_id: coachId,
      match_date: date,
      kick_off_time: kickOffTime || null,
      opponent,
      location: location || null,
      notes: notes || null,
      team_id: teamId || null,
    }
    if (meetTime) row.meet_time = meetTime

    const { data: match, error } = await supabase
      .from('match_events')
      .insert(row)
      .select('id')
      .single()

    if (error || !match) {
      const msg = error?.message ?? 'Failed to create match'
      setMessage({
        text: msg.includes('meet_time') ? 'Run 075_match_meet_time_wellbeing_notes.sql in Supabase, then try again.' : msg,
        ok: false,
      })
      setSaving(false)
      return
    }

    if (selected.size > 0) {
      const squadRows = Array.from(selected).map(player_id => ({
        match_id: match.id,
        player_id,
        status: 'invited',
      }))
      const { error: squadError } = await supabase.from('match_squads').insert(squadRows)
      if (squadError) {
        setMessage({ text: squadError.message, ok: false })
        setSaving(false)
        return
      }
      void fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'New match published',
          body: `You've been invited to the squad vs ${opponent} on ${date}${kickOffTime ? ` — kick-off ${formatEventTime(kickOffTime)}` : ''}${meetTime ? ` · meet ${formatEventTime(meetTime)}` : ''}`,
          targetUserIds: Array.from(selected),
          url: '/matches',
        }),
      }).catch(() => {})
    }

    setMessage({
      text: selected.size
        ? `Match vs ${opponent} created — ${selected.size} player(s) invited`
        : `Match vs ${opponent} created with no squad. Add players later from the match page.`,
      ok: true,
    })
    setDate(''); setKickOffTime(''); setMeetTime(''); setOpponent(''); setLocation(''); setNotes('')
    setTeamId('')
    setSelected(new Set())
    router.refresh()
    setSaving(false)
  }

  const teamPlayers = teamId ? students.filter(s => s.team_id === teamId) : []
  const otherPlayers = teamId ? students.filter(s => s.team_id !== teamId) : students

  return (
    <div className="bg-white rounded-xl border p-5 space-y-4 max-w-2xl">
      <h2 className="font-semibold">Create New Match</h2>
      <p className="text-xs text-muted-foreground">Players are optional. You can save the fixture first and invite later.</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Match Date</label>
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Meet time</label>
          <Input type="time" value={meetTime} onChange={e => setMeetTime(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Kick-off</label>
          <Input type="time" value={kickOffTime} onChange={e => setKickOffTime(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Opponent</label>
          <Input placeholder="e.g. Everton Academy" value={opponent} onChange={e => setOpponent(e.target.value)} />
        </div>
        <div className="space-y-1 col-span-2">
          <label className="text-xs font-medium text-muted-foreground">Location (optional)</label>
          <Input placeholder="e.g. Prenton Park" value={location} onChange={e => setLocation(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Notes (optional)</label>
        <Textarea placeholder="Kit, travel, team talk" value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="resize-none" />
      </div>

      <div>
        <label htmlFor="match-team" className="text-xs font-medium text-muted-foreground">Team</label>
        <select
          id="match-team"
          value={teamId}
          onChange={e => pickTeam(e.target.value)}
          className="w-full text-sm border rounded-lg px-3 py-2 bg-white mt-1"
        >
          <option value="">No team · pick players manually</option>
          {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">Squad (optional — add later if you want)</p>
        {teamId && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto mb-2">
            {teamPlayers.map(s => (
              <PlayerButton key={s.id} student={s} selected={selected.has(s.id)} onToggle={toggle} showTeam={false} />
            ))}
          </div>
        )}
        <details open={!teamId}>
          <summary className="text-xs font-medium text-muted-foreground cursor-pointer select-none">
            {teamId ? 'Other players (call-up)' : 'Players'}
          </summary>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto mt-2">
            {otherPlayers.map(s => (
              <PlayerButton key={s.id} student={s} selected={selected.has(s.id)} onToggle={toggle} showTeam />
            ))}
          </div>
        </details>
      </div>

      {message && (
        <p className={`text-sm ${message.ok ? 'text-green-700' : 'text-red-600'}`}>{message.text}</p>
      )}
      <Button
        onClick={handleCreate}
        disabled={saving || !date || !opponent}
        className="bg-tranmere-blue text-white"
      >
        {saving ? 'Creating…' : selected.size ? `Create match & invite ${selected.size}` : 'Create match (add players later)'}
      </Button>
    </div>
  )
}
