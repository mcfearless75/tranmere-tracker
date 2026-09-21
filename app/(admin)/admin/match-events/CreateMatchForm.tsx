'use client'
import { YearBadge } from '@/components/YearBadge'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { formatEventTime } from '@/lib/calendar/calendarUtils'

type Student = { id: string; name: string; year_group: number }
type Props = { students: Student[]; coachId: string }

export function CreateMatchForm({ students, coachId }: Props) {
  const router = useRouter()
  const [date, setDate] = useState('')
  const [kickOffTime, setKickOffTime] = useState('')
  const [meetTime, setMeetTime] = useState('')
  const [opponent, setOpponent] = useState('')
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
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
    setSelected(new Set())
    router.refresh()
    setSaving(false)
  }

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
        <p className="text-xs font-medium text-muted-foreground mb-2">Squad (optional — add later if you want)</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
          {students.map(s => (
            <button
              key={s.id}
              type="button"
              onClick={() => toggle(s.id)}
              className={`text-sm px-3 py-2 rounded-lg border text-left ${
                selected.has(s.id)
                  ? 'bg-tranmere-blue text-white border-tranmere-blue'
                  : 'bg-white text-gray-700 border-gray-200'
              }`}
            >
              <span className="flex items-center justify-between gap-1.5">
                <span className="truncate">{s.name}</span>
                <YearBadge year={s.year_group} />
              </span>
            </button>
          ))}
        </div>
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
