'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search, X } from 'lucide-react'
import { getOrCreateDM } from './actions'

type User = { id: string; name: string | null; role: string; avatar_url: string | null }

export function NewDmPicker({ directory }: { directory: User[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState<string | null>(null)

  const filtered = q.trim()
    ? directory.filter(u => (u.name ?? '').toLowerCase().includes(q.toLowerCase()))
    : directory

  async function start(userId: string) {
    setLoading(userId)
    const res = await getOrCreateDM(userId)
    setLoading(null)
    if (typeof res === 'string') router.push(`/chat/${res}`)
    else alert(`Error: ${res.error}`)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-tranmere-blue to-blue-700 text-white px-4 py-2.5 text-sm font-semibold shadow hover:shadow-lg"
      >
        <Plus size={14} /> New message
      </button>
    )
  }

  return (
    <div className="rounded-2xl border bg-white p-3 space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search people…"
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm"
          />
        </div>
        <button onClick={() => setOpen(false)} className="p-2 rounded-lg hover:bg-gray-100" aria-label="Close">
          <X size={14} />
        </button>
      </div>

      <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
        {filtered.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No match</p>}
        {filtered.map(u => {
          const initials = (u.name ?? '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
          return (
            <button
              key={u.id}
              onClick={() => start(u.id)}
              disabled={loading === u.id}
              className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-blue-50 text-left disabled:opacity-50"
            >
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
              {loading === u.id && <span className="text-xs text-muted-foreground">Opening…</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
