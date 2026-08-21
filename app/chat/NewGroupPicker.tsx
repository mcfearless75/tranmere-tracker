'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Users, Search, X } from 'lucide-react'
import { createGroupChat } from './actions'

type Person = { id: string; name: string | null; role: string; avatar_url: string | null }

export function NewGroupPicker({ directory }: { directory: Person[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filtered = q.trim()
    ? directory.filter(u => (u.name ?? '').toLowerCase().includes(q.toLowerCase()))
    : directory

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function submit() {
    setError(null)
    if (!name.trim()) { setError('Give the group a name'); return }
    if (selected.size === 0) { setError('Pick at least one member'); return }
    setSubmitting(true)
    const res = await createGroupChat(name.trim(), Array.from(selected))
    setSubmitting(false)
    if (typeof res === 'string') router.push(`/chat/${res}`)
    else setError(res.error)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-tranmere-blue text-tranmere-blue px-4 py-2.5 text-sm font-semibold hover:bg-tranmere-blue/5"
      >
        <Users size={14} /> New group
      </button>
    )
  }

  return (
    <div className="rounded-2xl border bg-white p-3 space-y-2">
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Group name (e.g. Match Day Chat)"
          className="flex-1 px-3 py-2 border rounded-lg text-sm"
        />
        <button onClick={() => setOpen(false)} className="p-2 rounded-lg hover:bg-gray-100" aria-label="Close">
          <X size={14} />
        </button>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search people…"
          className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm"
        />
      </div>

      <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
        {filtered.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No match</p>}
        {filtered.map(u => {
          const initials = (u.name ?? '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
          const checked = selected.has(u.id)
          return (
            <button
              key={u.id}
              onClick={() => toggle(u.id)}
              className={`w-full flex items-center gap-2.5 p-2 rounded-lg text-left ${checked ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
            >
              <input type="checkbox" checked={checked} readOnly className="shrink-0" />
              {u.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={u.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
              ) : (
                <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-tranmere-blue text-white text-xs font-bold shrink-0">
                  {initials}
                </span>
              )}
              <span className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{u.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{u.role}</p>
              </span>
            </button>
          )
        })}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        onClick={submit}
        disabled={submitting}
        className="w-full rounded-xl bg-gradient-to-r from-tranmere-blue to-blue-700 text-white px-4 py-2.5 text-sm font-semibold shadow disabled:opacity-50"
      >
        {submitting ? 'Creating…' : `Create group${selected.size ? ` (${selected.size})` : ''}`}
      </button>
    </div>
  )
}
