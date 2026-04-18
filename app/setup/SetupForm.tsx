'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export function SetupForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    setSaving(true)
    setError('')
    const res = await fetch('/api/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    })
    const data = await res.json()
    if (data.error) {
      setError(data.error)
      setSaving(false)
    } else {
      router.push('/login')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>
      )}
      <div className="space-y-1">
        <label className="text-sm font-medium">Full Name</label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Paul McWilliam" required />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium">Email</label>
        <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium">Password</label>
        <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 8 characters" required />
      </div>
      <Button type="submit" disabled={saving || !name || !email || !password} className="w-full bg-tranmere-blue hover:bg-blue-900 text-white">
        {saving ? 'Creating superuser…' : 'Create Superuser Account'}
      </Button>
    </form>
  )
}
