'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export function SetupForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (pin.length < 5 || pin.length > 6) { setError('PIN must be 5 or 6 digits'); return }
    if (!/^\d+$/.test(pin)) { setError('PIN must be numbers only'); return }
    if (pin !== confirm) { setError('PINs do not match'); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, pin }),
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
        setSaving(false)
      } else {
        // Navigating away — deliberately leave `saving` true so the form
        // cannot be submitted twice while the route transition is in flight.
        router.push('/admin-login')
      }
    } catch {
      // fetch REJECTS on a network failure rather than returning a response.
      setError('Could not reach the server — you may be offline. Try again.')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>
      )}
      <div className="space-y-1">
        <label className="text-sm font-medium">Your Name</label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Paul McWilliam" required />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium">Admin PIN (5 or 6 digits)</label>
        <Input
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="Choose your PIN"
          required
          className="tracking-widest text-center text-lg"
        />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium">Confirm PIN</label>
        <Input
          type="password"
          inputMode="numeric"
          value={confirm}
          onChange={e => setConfirm(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="Repeat your PIN"
          required
          className="tracking-widest text-center text-lg"
        />
      </div>
      <Button type="submit" disabled={saving || !name || pin.length < 5} className="w-full bg-tranmere-blue hover:bg-blue-900 text-white">
        {saving ? 'Creating account…' : 'Create Superuser Account'}
      </Button>
    </form>
  )
}
