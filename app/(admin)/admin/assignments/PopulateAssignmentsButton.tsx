'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles } from 'lucide-react'

export function PopulateAssignmentsButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function populate() {
    if (!confirm('This will add official BTEC assignments to every unit (Level 2 Sport, Level 3 Coaching, Level 3 Science). Existing assignments with the same title are skipped. Continue?')) return
    setLoading(true)
    setMsg(null)
    const res = await fetch('/api/admin/populate-assignments', { method: 'POST' })
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
        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg hover:shadow-xl transition-shadow disabled:opacity-50"
      >
        <Sparkles size={16} className={loading ? 'animate-spin' : ''} />
        {loading ? 'Populating assignments…' : 'Populate BTEC Assignments'}
      </button>
      {msg && <p className="mt-2 text-xs text-muted-foreground">{msg}</p>}
    </div>
  )
}
