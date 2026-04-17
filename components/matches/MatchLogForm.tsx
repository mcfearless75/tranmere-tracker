'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

const POSITIONS = ['GK', 'RB', 'CB', 'LB', 'CDM', 'CM', 'CAM', 'RW', 'LW', 'ST']

type Props = { studentId: string }

export function MatchLogForm({ studentId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [opponent, setOpponent] = useState('')
  const [goals, setGoals] = useState('0')
  const [assists, setAssists] = useState('0')
  const [minutes, setMinutes] = useState('90')
  const [position, setPosition] = useState('ST')
  const [rating, setRating] = useState('7')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!opponent.trim()) return
    setSaving(true)
    await supabase.from('match_logs').insert({
      student_id: studentId,
      match_date: date,
      opponent: opponent.trim(),
      goals: Math.max(0, Number(goals)),
      assists: Math.max(0, Number(assists)),
      minutes_played: Math.max(0, Math.min(120, Number(minutes))),
      position,
      self_rating: Number(rating),
      notes: notes.trim() || null,
    })
    setOpponent('')
    setNotes('')
    setGoals('0')
    setAssists('0')
    setSaving(false)
    router.refresh()
  }

  return (
    <div className="bg-white rounded-xl border p-4 space-y-3">
      <h2 className="font-semibold text-sm">Log Match</h2>

      <div className="grid grid-cols-2 gap-2">
        <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="text-sm" />
        <Input
          placeholder="Opponent"
          value={opponent}
          onChange={e => setOpponent(e.target.value)}
          className="text-sm"
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Goals</label>
          <Input type="number" value={goals} onChange={e => setGoals(e.target.value)} min="0" className="text-sm text-center" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Assists</label>
          <Input type="number" value={assists} onChange={e => setAssists(e.target.value)} min="0" className="text-sm text-center" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Minutes</label>
          <Input type="number" value={minutes} onChange={e => setMinutes(e.target.value)} min="0" max="120" className="text-sm text-center" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <select
          value={position}
          onChange={e => setPosition(e.target.value)}
          className="text-sm border rounded-lg px-3 py-2 bg-white"
        >
          {POSITIONS.map(p => <option key={p}>{p}</option>)}
        </select>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground shrink-0">Rating</label>
          <input
            type="range"
            min="1"
            max="10"
            value={rating}
            onChange={e => setRating(e.target.value)}
            className="flex-1 accent-tranmere-blue"
          />
          <span className="text-sm font-bold w-5 text-center text-tranmere-blue">{rating}</span>
        </div>
      </div>

      <Textarea
        placeholder="Notes (optional)"
        value={notes}
        onChange={e => setNotes(e.target.value)}
        rows={2}
        className="text-sm resize-none"
      />

      <Button
        onClick={handleSave}
        disabled={saving || !opponent.trim()}
        className="w-full bg-tranmere-blue text-white py-3"
      >
        {saving ? 'Saving…' : 'Log Match'}
      </Button>
    </div>
  )
}
