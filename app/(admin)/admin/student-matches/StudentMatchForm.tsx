'use client'
import { useState, useTransition } from 'react'
import { logStudentMatch } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Student { id: string; name: string; courses: { name: string } | null }

export function StudentMatchForm({ students }: { students: Student[] }) {
  const [, startTransition] = useTransition()
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [form, setForm] = useState({
    student_id: '',
    match_date: new Date().toISOString().split('T')[0],
    opponent: '',
    goals: '0',
    assists: '0',
    minutes_played: '90',
    rating: '7',
    position: '',
    notes: '',
  })

  function set(key: string, val: string) {
    setForm(f => ({ ...f, [key]: val }))
    setSuccess(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.student_id || !form.opponent) return
    setSaving(true)
    startTransition(async () => {
      await logStudentMatch(form)
      setSuccess(true)
      setForm(f => ({ ...f, opponent: '', goals: '0', assists: '0', rating: '7', notes: '' }))
      setSaving(false)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border p-4 space-y-4">
      <h2 className="font-semibold text-sm">Log Match for Student</h2>
      {success && <p className="text-green-600 text-sm">Match logged successfully!</p>}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Student</label>
          <select
            required
            value={form.student_id}
            onChange={e => set('student_id', e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Select student…</option>
            {students.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Date</label>
          <Input type="date" value={form.match_date} onChange={e => set('match_date', e.target.value)} className="text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Opponent</label>
          <Input placeholder="e.g. Chester FC" value={form.opponent} onChange={e => set('opponent', e.target.value)} className="text-sm" required />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Goals</label>
          <Input type="number" min="0" value={form.goals} onChange={e => set('goals', e.target.value)} className="text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Assists</label>
          <Input type="number" min="0" value={form.assists} onChange={e => set('assists', e.target.value)} className="text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Minutes Played</label>
          <Input type="number" min="0" max="120" value={form.minutes_played} onChange={e => set('minutes_played', e.target.value)} className="text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Rating (1–10)</label>
          <Input type="number" min="1" max="10" value={form.rating} onChange={e => set('rating', e.target.value)} className="text-sm" />
        </div>
        <div className="col-span-2 space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Position</label>
          <Input placeholder="e.g. Centre Mid" value={form.position} onChange={e => set('position', e.target.value)} className="text-sm" />
        </div>
        <div className="col-span-2 space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Notes</label>
          <Input placeholder="Optional coach notes" value={form.notes} onChange={e => set('notes', e.target.value)} className="text-sm" />
        </div>
      </div>
      <Button type="submit" disabled={saving} className="w-full bg-tranmere-blue hover:bg-blue-900">
        {saving ? 'Saving…' : 'Log Match'}
      </Button>
    </form>
  )
}
