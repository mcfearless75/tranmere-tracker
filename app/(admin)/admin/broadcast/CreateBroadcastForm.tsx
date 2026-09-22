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
    try {
      const res = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const data = await res.json()
      if (data.roomId) {
        setName('')
        router.push(`/chat/${data.roomId}`)
        router.refresh()
      } else {
        alert(data.error ?? 'Failed to create broadcast')
      }
    } catch {
      // fetch REJECTS on a network failure rather than returning a response,
      // so without the finally this button stayed disabled until a reload.
      alert('Could not reach the server — you may be offline. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={create} className="space-y-1.5">
      <div className="flex gap-2">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Season Update, Pre-Match Info…"
          maxLength={60}
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
      </div>
      {/* This is just a short title for the channel, not the announcement
          itself — a short label here was getting mistaken for the message
          box, leaving channels created with no actual message posted. */}
      <p className="text-[11px] text-muted-foreground">
        Just a short title ({name.length}/60) — you&apos;ll write the actual message once the channel opens.
      </p>
    </form>
  )
}
