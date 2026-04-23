'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Sparkles, ChevronDown, ChevronUp } from 'lucide-react'

type Unit = { id: string; unit_number: string; unit_name: string; course_name: string }
type Suggestion = { title: string; description: string; gradeTarget: string }
type Props = { units: Unit[] }

export function CreateAssignmentForm({ units }: Props) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [unitId, setUnitId] = useState(units[0]?.id ?? '')
  const [dueDate, setDueDate] = useState('')
  const [target, setTarget] = useState<'Pass' | 'Merit' | 'Distinction'>('Merit')
  const [saving, setSaving] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const supabase = createClient()
  const router = useRouter()

  const selectedUnit = units.find(u => u.id === unitId)

  async function handleAiSuggest() {
    if (!selectedUnit) return
    setSuggesting(true)
    setSuggestions([])
    try {
      const res = await fetch('/api/admin/ai/suggest-assignment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unitName: selectedUnit.unit_name,
          courseName: selectedUnit.course_name,
          unitNumber: selectedUnit.unit_number,
        }),
      })
      const data = await res.json()
      if (data.suggestions) setSuggestions(data.suggestions)
    } catch { /* silent */ }
    setSuggesting(false)
  }

  function applySuggestion(s: Suggestion) {
    setTitle(s.title)
    setDescription(s.description)
    setTarget(s.gradeTarget as 'Pass' | 'Merit' | 'Distinction')
    setSuggestions([])
  }

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
    setTitle(''); setDescription(''); setDueDate(''); setSuggestions([])
    setSaving(false)
    router.refresh()
  }

  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold hover:bg-gray-50 transition-colors"
      >
        <span>+ Create Assignment</span>
        {open ? <ChevronUp size={15} className="text-muted-foreground" /> : <ChevronDown size={15} className="text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t pt-3">
          {/* Unit picker + AI suggest */}
          <div className="flex gap-2">
            <select
              value={unitId}
              onChange={e => { setUnitId(e.target.value); setSuggestions([]) }}
              className="flex-1 text-sm border rounded-lg px-3 py-2 bg-white"
            >
              {units.length === 0 && <option value="">No units yet — add in Courses first</option>}
              {units.map(u => (
                <option key={u.id} value={u.id}>
                  {u.course_name} — {u.unit_number}: {u.unit_name}
                </option>
              ))}
            </select>
            <button
              onClick={handleAiSuggest}
              disabled={suggesting || units.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 whitespace-nowrap transition-colors"
            >
              <Sparkles size={13} />
              {suggesting ? 'Thinking…' : 'AI Suggest'}
            </button>
          </div>

          {/* AI suggestions */}
          {suggestions.length > 0 && (
            <div className="rounded-lg border border-purple-200 bg-purple-50 divide-y divide-purple-100 overflow-hidden">
              <p className="px-3 py-1.5 text-[11px] font-semibold text-purple-700 uppercase tracking-wide">AI suggestions — click to use</p>
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => applySuggestion(s)}
                  className="w-full text-left px-3 py-2.5 hover:bg-purple-100 transition-colors"
                >
                  <p className="text-sm font-medium text-gray-900">{s.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{s.description}</p>
                  <span className="text-[10px] text-purple-600 font-medium">{s.gradeTarget}</span>
                </button>
              ))}
            </div>
          )}

          {/* Title */}
          <input
            placeholder="Assignment title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full text-sm border rounded-lg px-3 py-2 focus:ring-2 focus:ring-tranmere-blue outline-none"
          />

          {/* Description */}
          <textarea
            placeholder="Description (optional)"
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
            className="w-full text-sm border rounded-lg px-3 py-2 resize-none focus:ring-2 focus:ring-tranmere-blue outline-none"
          />

          {/* Due date + target */}
          <div className="grid grid-cols-2 gap-2">
            <select
              value={target}
              onChange={e => setTarget(e.target.value as any)}
              className="text-sm border rounded-lg px-3 py-2 bg-white"
            >
              <option>Pass</option>
              <option>Merit</option>
              <option>Distinction</option>
            </select>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="text-sm border rounded-lg px-3 py-2 focus:ring-2 focus:ring-tranmere-blue outline-none"
            />
          </div>

          <button
            onClick={handleCreate}
            disabled={saving || !title.trim() || !dueDate || !unitId || units.length === 0}
            className="w-full py-2 text-sm font-medium rounded-lg bg-tranmere-blue text-white hover:bg-blue-900 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Creating…' : 'Create Assignment'}
          </button>
        </div>
      )}
    </div>
  )
}
