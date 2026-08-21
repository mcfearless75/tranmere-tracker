'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, X } from 'lucide-react'
import { addGroupMembers } from '../actions'

type Person = { id: string; name: string | null; role: string }

export function AddGroupMembers({ roomId, addable }: { roomId: string; addable: Person[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const filtered = q.trim()
    ? addable.filter(u => (u.name ?? '').toLowerCase().includes(q.toLowerCase()))
    : addable

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function submit() {
    setError(null)
    if (selected.size === 0) { setError('Pick at least one person'); return }
    start(async () => {
      const res = await addGroupMembers(roomId, Array.from(selected))
      if (res.ok) {
        setOpen(false)
        setSelected(new Set())
        router.refresh()
      } else {
        setError(res.error ?? 'Failed to add members')
      }
    })
  }

  if (addable.length === 0 && !open) return null

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs font-semibold text-tranmere-blue"
      >
        <UserPlus size={13} /> Add people
      </button>
    )
  }

  return (
    <div className="border rounded-xl p-2 space-y-2 bg-gray-50">
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search people…"
          className="flex-1 px-2 py-1.5 border rounded-lg text-xs"
        />
        <button onClick={() => setOpen(false)} aria-label="Close" className="p-1 rounded hover:bg-gray-200">
          <X size={13} />
        </button>
      </div>

      <div className="max-h-32 overflow-y-auto space-y-1">
        {filtered.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">No match</p>}
        {filtered.map(u => {
          const checked = selected.has(u.id)
          return (
            <button
              key={u.id}
              onClick={() => toggle(u.id)}
              className={`w-full flex items-center gap-2 p-1.5 rounded-lg text-left text-xs ${checked ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
            >
              <input type="checkbox" checked={checked} readOnly />
              <span className="flex-1 truncate">{u.name}</span>
            </button>
          )
        })}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        onClick={submit}
        disabled={pending}
        className="w-full rounded-lg bg-tranmere-blue text-white px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
      >
        {pending ? 'Adding…' : `Add${selected.size ? ` (${selected.size})` : ''}`}
      </button>
    </div>
  )
}
