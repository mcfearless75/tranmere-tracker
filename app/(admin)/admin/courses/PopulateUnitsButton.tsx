'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BookOpen } from 'lucide-react'

export function PopulateUnitsButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function populate() {
    if (!confirm('This will add the full BTEC unit lists to all three courses. Existing units are preserved. Continue?')) return
    setLoading(true)
    setMsg(null)
    const res = await fetch('/api/admin/populate-btec-units', { method: 'POST' })
    const data = await res.json()
    if (data.error) setMsg(`Error: ${data.error}`)
    else { setMsg(data.message); router.refresh() }
    setLoading(false)
  }

  return (
    <div>
      <button
        onClick={populate}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-tranmere-blue to-blue-800 px-4 py-2 text-sm font-semibold text-white shadow hover:shadow-lg transition-shadow disabled:opacity-50"
      >
        <BookOpen size={16} className={loading ? 'animate-pulse' : ''} />
        {loading ? 'Populating BTEC units…' : 'Populate BTEC Units'}
      </button>
      {msg && <p className="mt-2 text-xs text-muted-foreground">{msg}</p>}
    </div>
  )
}
