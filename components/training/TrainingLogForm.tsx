'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

const SESSION_TYPES = [
  'Gym',
  'Pitch Session',
  'Cardio',
  'Recovery',
  'Match Preparation',
  'Strength & Conditioning',
]

type Props = { studentId: string }

export function TrainingLogForm({ studentId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [type, setType] = useState('Gym')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [duration, setDuration] = useState('')
  const [intensity, setIntensity] = useState<'low' | 'medium' | 'high'>('medium')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!duration || Number(duration) < 1) return
    setSaving(true)
    await supabase.from('training_logs').insert({
      student_id: studentId,
      session_date: date,
      session_type: type,
      duration_mins: Number(duration),
      intensity,
      notes: notes.trim() || null,
    })
    setDuration('')
    setNotes('')
    setSaving(false)
    router.refresh()
  }

  return (
    <div className="bg-white rounded-xl border p-4 space-y-3">
      <h2 className="font-semibold text-sm">Log Session</h2>

      <select
        value={type}
        onChange={e => setType(e.target.value)}
        className="w-full text-sm border rounded-lg px-3 py-2 bg-white"
      >
        {SESSION_TYPES.map(t => <option key={t}>{t}</option>)}
      </select>

      <div className="grid grid-cols-2 gap-2">
        <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="text-sm" />
        <Input
          type="number"
          placeholder="Duration (mins)"
          value={duration}
          onChange={e => setDuration(e.target.value)}
          min="1"
          className="text-sm"
        />
      </div>

      <div className="flex gap-2">
        {(['low', 'medium', 'high'] as const).map(i => (
          <button
            key={i}
            type="button"
            onClick={() => setIntensity(i)}
            className={`flex-1 text-xs py-2.5 rounded-lg border font-medium capitalize transition-colors ${
              intensity === i
                ? 'bg-tranmere-blue text-white border-tranmere-blue'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
          >
            {i}
          </button>
        ))}
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
        disabled={saving || !duration}
        className="w-full bg-tranmere-blue text-white py-3"
      >
        {saving ? 'Saving…' : 'Log Session'}
      </Button>
    </div>
  )
}
