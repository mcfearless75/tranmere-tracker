'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2, Check, X } from 'lucide-react'

type Unit = { id: string; unit_number: string; unit_name: string; course_name: string }

type Props = {
  assignment: {
    id: string
    title: string
    description?: string | null
    due_date: string
    grade_target: string | null
    unit_id?: string
    btec_units: { unit_name: string; courses: { name: string } | null } | null
  }
  units: Unit[]
}

const targetColour: Record<string, string> = {
  Pass: 'bg-green-100 text-green-700',
  Merit: 'bg-blue-100 text-blue-700',
  Distinction: 'bg-purple-100 text-purple-700',
}

export function AssignmentRow({ assignment: a, units }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState(a.title)
  const [dueDate, setDueDate] = useState(a.due_date)
  const [target, setTarget] = useState(a.grade_target ?? 'Merit')
  const [unitId, setUnitId] = useState(a.unit_id ?? units[0]?.id ?? '')

  const daysLeft = Math.ceil((new Date(dueDate).getTime() - Date.now()) / 86400000)
  const unit = a.btec_units

  async function save() {
    setSaving(true)
    const res = await fetch(`/api/admin/assignments/${a.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, due_date: dueDate, grade_target: target, unit_id: unitId }),
    })
    setSaving(false)
    if (res.ok) { setEditing(false); startTransition(() => router.refresh()) }
  }

  async function remove() {
    if (!confirm(`Delete "${a.title}"? This cannot be undone.`)) return
    await fetch(`/api/admin/assignments/${a.id}`, { method: 'DELETE' })
    startTransition(() => router.refresh())
  }

  if (editing) {
    return (
      <tr className="border-b bg-blue-50/40">
        <td className="px-3 py-2">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full text-sm border rounded px-2 py-1 focus:ring-1 focus:ring-tranmere-blue outline-none"
          />
        </td>
        <td className="px-3 py-2" colSpan={2}>
          <select
            value={unitId}
            onChange={e => setUnitId(e.target.value)}
            className="w-full text-xs border rounded px-2 py-1 bg-white"
          >
            {units.map(u => (
              <option key={u.id} value={u.id}>
                {u.course_name} — {u.unit_number}: {u.unit_name}
              </option>
            ))}
          </select>
        </td>
        <td className="px-3 py-2">
          <input
            type="date"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
            className="text-xs border rounded px-2 py-1 focus:ring-1 focus:ring-tranmere-blue outline-none"
          />
        </td>
        <td className="px-3 py-2">
          <select
            value={target}
            onChange={e => setTarget(e.target.value)}
            className="text-xs border rounded px-2 py-1 bg-white"
          >
            <option>Pass</option>
            <option>Merit</option>
            <option>Distinction</option>
          </select>
        </td>
        <td className="px-3 py-2">
          <div className="flex items-center gap-1">
            <button onClick={save} disabled={saving}
              className="p-1.5 rounded bg-tranmere-blue text-white hover:bg-blue-900 disabled:opacity-50">
              <Check size={13} />
            </button>
            <button onClick={() => setEditing(false)}
              className="p-1.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-600">
              <X size={13} />
            </button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr className="border-b last:border-0 hover:bg-gray-50 group">
      <td className="px-3 py-2.5 font-medium text-sm">{a.title}</td>
      <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-[160px] truncate">{unit?.unit_name}</td>
      <td className="px-3 py-2.5 text-xs text-muted-foreground">{unit?.courses?.name}</td>
      <td className="px-3 py-2.5 text-xs whitespace-nowrap">
        {new Date(a.due_date).toLocaleDateString('en-GB')}
        {daysLeft >= 0 && daysLeft <= 7 && (
          <span className="ml-1.5 text-red-600 font-medium">{daysLeft}d</span>
        )}
        {daysLeft < 0 && (
          <span className="ml-1.5 text-gray-400 line-through text-[10px]">overdue</span>
        )}
      </td>
      <td className="px-3 py-2.5">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${targetColour[a.grade_target ?? ''] ?? 'bg-gray-100 text-gray-600'}`}>
          {a.grade_target ?? '—'}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => setEditing(true)}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-tranmere-blue">
            <Pencil size={13} />
          </button>
          <button onClick={remove}
            className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600">
            <Trash2 size={13} />
          </button>
        </div>
      </td>
    </tr>
  )
}
