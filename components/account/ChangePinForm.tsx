'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle2 } from 'lucide-react'

const DEFAULT_PINS = new Set(['000000', '00000'])

export function ChangePinForm({ onDone }: { onDone?: () => void }) {
  const router = useRouter()
  const supabase = createClient()
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function save() {
    setError('')
    if (!/^\d{5,6}$/.test(pin)) { setError('PIN must be 5 or 6 digits'); return }
    if (pin !== confirm) { setError("PINs don't match — try again"); return }
    if (DEFAULT_PINS.has(pin)) { setError('Pick something other than the shared default PIN'); return }

    setSaving(true)
    const { error: authErr } = await supabase.auth.updateUser({ password: pin })
    if (authErr) {
      setSaving(false)
      setError(authErr.message)
      return
    }

    // Best-effort — the PIN itself is already changed either way, this just
    // clears the "still on default" nudge.
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('users').update({ must_change_pin: false }).eq('id', user.id)
    }

    setSaving(false)
    setSuccess(true)
    setPin('')
    setConfirm('')
    router.refresh()
    // Let the "PIN updated" confirmation actually be seen before any parent
    // (e.g. the dashboard nudge card) reacts to onDone and unmounts us.
    setTimeout(() => onDone?.(), 1800)
  }

  if (success) {
    return (
      <div className="flex items-center gap-2 text-green-700 text-sm font-medium py-1.5">
        <CheckCircle2 size={16} /> PIN updated — use it next time you sign in.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <input
          type="password"
          inputMode="numeric"
          placeholder="New PIN"
          value={pin}
          onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
          className="border rounded-lg px-3 py-2 text-sm text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-tranmere-blue"
        />
        <input
          type="password"
          inputMode="numeric"
          placeholder="Confirm PIN"
          value={confirm}
          onChange={e => setConfirm(e.target.value.replace(/\D/g, '').slice(0, 6))}
          className="border rounded-lg px-3 py-2 text-sm text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-tranmere-blue"
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        onClick={save}
        disabled={saving || pin.length < 5 || confirm.length < 5}
        className="w-full rounded-lg bg-tranmere-blue text-white px-4 py-2 text-sm font-semibold hover:bg-blue-900 disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save my new PIN'}
      </button>
      <p className="text-[11px] text-muted-foreground">
        5 or 6 digits, only you know it. Forget it later? Ask a coach or teacher to reset it for you.
      </p>
    </div>
  )
}
