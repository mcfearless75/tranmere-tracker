'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, Loader2 } from 'lucide-react'

type Props = { coachId: string }

export function NewSessionForm({ coachId }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [label, setLabel] = useState('')
  const [type, setType] = useState<'training' | 'match' | 'classroom'>('training')
  const [open, setOpen] = useState(false)

  async function create() {
    if (!label.trim()) return
    const supabase = createClient()

    // Generate a 6-char PIN client-side (server RPC generates next rotations)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    const pin = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')

    const { data, error } = await supabase
      .from('attendance_sessions')
      .insert({
        created_by: coachId,
        session_label: label.trim(),
        session_type: type,
        pin_code: pin,
        pin_expires_at: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
      })
      .select('id')
      .single()

    if (error || !data) return alert('Could not create session: ' + error?.message)

    startTransition(() => {
      router.push(`/admin/attendance/${data.id}`)
    })
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 bg-tranmere-blue text-white rounded-xl py-3 text-sm font-semibold hover:bg-blue-900 transition-colors"
      >
        <Plus size={16} /> Open New Attendance Session
      </button>
    )
  }

  return (
    <div className="bg-white border rounded-xl p-4 space-y-3">
      <p className="font-semibold text-sm">New Session</p>

      <input
        type="text"
        placeholder="Session label  e.g. Thursday Training"
        value={label}
        onChange={e => setLabel(e.target.value)}
        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tranmere-blue"
        autoFocus
      />

      <div className="flex gap-2">
        {(['training', 'match', 'classroom'] as const).map(t => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors ${type === t ? 'bg-tranmere-blue text-white border-tranmere-blue' : 'text-muted-foreground border-gray-200'}`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setOpen(false)}
          className="flex-1 py-2.5 rounded-lg text-sm border text-muted-foreground"
        >
          Cancel
        </button>
        <button
          onClick={create}
          disabled={isPending || !label.trim()}
          className="flex-1 py-2.5 rounded-lg text-sm bg-tranmere-blue text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isPending ? <Loader2 size={14} className="animate-spin" /> : null}
          Start Session
        </button>
      </div>
    </div>
  )
}
