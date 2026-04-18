'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

type Unit = { id: string; unit_number: string; unit_name: string; course_name: string }
type Props = { units: Unit[] }

export function CreateAssignmentForm({ units }: Props) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [unitId, setUnitId] = useState(units[0]?.id ?? '')
  const [dueDate, setDueDate] = useState('')
  const [target, setTarget] = useState<'Pass' | 'Merit' | 'Distinction'>('Merit')
  const [saving, setSaving] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  async function handleCreate() {
    if (!title.trim() || !dueDate || !unitId) return
    setSaving(true)
    await supabase.from('assignments').insert({
      title: title.trim(),
      description: description.trim() || null,
      unit_id: unitId,
      due_date: dueDate,
      grade_target: target,
    })
    setTitle('')
    setDescription('')
    setDueDate('')
    setSaving(false)
    router.refresh()
  }

  return (
    <div className="bg-white rounded-xl border p-4 space-y-3 max-w-xl">
      <h2 className="font-semibold text-sm">Create Assignment</h2>
      <Input placeholder="Assignment title" value={title} onChange={e => setTitle(e.target.value)} className="text-sm" />
      <Textarea
        placeholder="Description (optional)"
        value={description}
        onChange={e => setDescription(e.target.value)}
        rows={2}
        className="text-sm resize-none"
      />
      <div className="grid grid-cols-2 gap-2">
        <select
          value={unitId}
          onChange={e => setUnitId(e.target.value)}
          className="text-sm border rounded-lg px-3 py-2 bg-white col-span-2"
        >
          {units.length === 0 && <option value="">No units yet — add units in Courses first</option>}
          {units.map(u => (
            <option key={u.id} value={u.id}>
              {u.course_name} — {u.unit_number}: {u.unit_name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <select
          value={target}
          onChange={e => setTarget(e.target.value as 'Pass' | 'Merit' | 'Distinction')}
          className="text-sm border rounded-lg px-3 py-2 bg-white"
        >
          <option>Pass</option>
          <option>Merit</option>
          <option>Distinction</option>
        </select>
        <Input
          type="date"
          value={dueDate}
          onChange={e => setDueDate(e.target.value)}
          className="text-sm"
        />
      </div>
      <Button
        onClick={handleCreate}
        disabled={saving || !title.trim() || !dueDate || !unitId || units.length === 0}
        className="bg-tranmere-blue text-white"
      >
        {saving ? 'Creating…' : 'Create Assignment'}
      </Button>
    </div>
  )
}
