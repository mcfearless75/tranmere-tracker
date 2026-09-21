'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { StaffOption } from '@/components/admin/recruitment/TrialEventForm'

export function TrialStaffEditor({
  trialEventId,
  assigned,
  staff,
}: {
  trialEventId: string
  assigned: StaffOption[]
  staff: StaffOption[]
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<string[]>(assigned.map(s => s.id))
  const [notify, setNotify] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  function toggle(id: string) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function save() {
    setSaving(true)
    setError(null)
    setOk(null)
    try {
      const res = await fetch(`/api/recruitment/trials/${trialEventId}/staff`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff_ids: selected, notify }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Could not update staff.')
        return
      }
      setOk(notify ? 'Saved and notified.' : 'Saved.')
      router.refresh()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
      <h2 className="text-sm font-bold text-tranmere-blue">Staff</h2>
      <p className="text-xs text-muted-foreground">Tick who should run / see this trial. They get a push if notifications are on.</p>
      <ul className="max-h-48 overflow-y-auto space-y-1">
        {staff.map(s => (
          <li key={s.id}>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selected.includes(s.id)}
                onChange={() => toggle(s.id)}
                className="h-4 w-4 accent-tranmere-blue"
              />
              {s.name}
            </label>
          </li>
        ))}
      </ul>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" checked={notify} onChange={e => setNotify(e.target.checked)} className="h-4 w-4 accent-tranmere-blue" />
        Notify selected staff when I save
      </label>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {ok && <p className="text-xs text-green-700">{ok}</p>}
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="rounded-xl bg-tranmere-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save staff'}
      </button>
    </div>
  )
}
