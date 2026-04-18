'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

type Student = { id: string; name: string }
type Props = { students: Student[]; coachId: string }

export function CreateMatchForm({ students, coachId }: Props) {
  const router = useRouter()
  const [date, setDate] = useState('')
  const [opponent, setOpponent] = useState('')
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleCreate() {
    if (!date || !opponent) { setMessage({ text: 'Date and opponent required', ok: false }); return }
    if (selected.size === 0) { setMessage({ text: 'Select at least one player', ok: false }); return }
    setSaving(true)
    setMessage(null)
    const supabase = createClient()

    const { data: match, error } = await supabase
      .from('match_events')
      .insert({ coach_id: coachId, match_date: date, opponent, location: location || null, notes: notes || null })
      .select('id')
      .single()

    if (error || !match) {
      setMessage({ text: error?.message ?? 'Failed to create match', ok: false })
      setSaving(false)
      return
    }

    const squadRows = Array.from(selected).map(player_id => ({
      match_id: match.id,
      player_id,
      status: 'invited',
    }))

    const { error: squadError } = await supabase.from('match_squads').insert(squadRows)
    if (squadError) {
      setMessage({ text: squadError.message, ok: false })
    } else {
      setMessage({ text: `Match vs ${opponent} created — ${selected.size} player(s) notified`, ok: true })
      setDate(''); setOpponent(''); setLocation(''); setNotes('')
      setSelected(new Set())
      router.refresh()
    }
    setSaving(false)
  }

  return (
    <div className="bg-white rounded-xl border p-5 space-y-4 max-w-2xl">
      <h2 className="font-semibold">Create New Match</h2>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Match Date</label>
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Opponent</label>
          <Input placeholder="e.g. Everton Academy" value={opponent} onChange={e => setOpponent(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Location (optional)</label>
          <Input placeholder="e.g. Prenton Park" value={location} onChange={e => setLocation(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Notes (optional)</label>
          <Input placeholder="Team talk, kit etc." value={notes} onChange={e => setNotes(e.target.value)} />
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">Select Players for Squad</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
          {students.map(s => (
            <button
              key={s.id}
              onClick={() => toggle(s.id)}
              className={`text-sm px-3 py-2 rounded-lg border text-left transition-all ${
                selected.has(s.id)
                  ? 'bg-tranmere-blue text-white border-tranmere-blue'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-tranmere-blue'
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
        {students.length === 0 && (
          <p className="text-sm text-muted-foreground">No students found — create some first.</p>
        )}
      </div>

      {message && (
        <p className={`text-sm ${message.ok ? 'text-green-700' : 'text-red-600'}`}>{message.text}</p>
      )}
      <Button
        onClick={handleCreate}
        disabled={saving || !date || !opponent || selected.size === 0}
        className="bg-tranmere-blue text-white"
      >
        {saving ? 'Creating…' : `Create Match & Invite ${selected.size || ''} Player${selected.size !== 1 ? 's' : ''}`}
      </Button>
    </div>
  )
}
