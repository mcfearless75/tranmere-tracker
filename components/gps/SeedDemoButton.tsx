'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles } from 'lucide-react'

export function SeedDemoButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function seed() {
    if (!confirm('This will create 10 demo players with 8 GPS sessions each, 2 matches, and 3 assignments. Good for a demo — not for production. Continue?')) return
    setLoading(true)
    setMsg(null)
    const res = await fetch('/api/admin/seed-demo', { method: 'POST' })
    const data = await res.json()
    if (data.error) setMsg(`Error: ${data.error}`)
    else { setMsg(data.message); router.refresh() }
    setLoading(false)
  }

  return (
    <div>
      <button
        onClick={seed}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-lg hover:shadow-xl transition-shadow disabled:opacity-50"
      >
        <Sparkles size={16} className={loading ? 'animate-spin' : ''} />
        {loading ? 'Seeding demo data…' : 'Populate Demo Data'}
      </button>
      {msg && <p className="mt-2 text-xs text-muted-foreground">{msg}</p>}
    </div>
  )
}
