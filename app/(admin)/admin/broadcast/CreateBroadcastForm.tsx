'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Megaphone } from 'lucide-react'

export function CreateBroadcastForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    const res = await fetch('/api/admin/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    const data = await res.json()
    setLoading(false)
    if (data.roomId) {
      setName('')
      router.push(`/chat/${data.roomId}`)
      router.refresh()
    } else {
      alert(data.error ?? 'Failed to create broadcast')
    }
  }

  return (
    <form onSubmit={create} className="flex gap-2">
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="e.g. Season Update, Pre-Match Info…"
        className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-tranmere-blue outline-none"
        required
      />
      <button
        type="submit"
        disabled={!name.trim() || loading}
        className="flex items-center gap-1.5 bg-tranmere-blue text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-blue-900 transition-colors"
      >
        <Megaphone size={15} />
        {loading ? 'Creating…' : 'Create'}
      </button>
    </form>
  )
}
