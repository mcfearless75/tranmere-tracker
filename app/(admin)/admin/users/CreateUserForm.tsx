'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Course = { id: string; name: string }
type Props = { courses: Course[] }

function toUsername(name: string) {
  return name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 20)
}

export function CreateUserForm({ courses }: Props) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [pin, setPin] = useState('')
  const [role, setRole] = useState<'student' | 'coach' | 'teacher' | 'admin'>('student')
  const [courseId, setCourseId] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)

  function handleNameChange(v: string) {
    setName(v)
    setUsername(toUsername(v))
  }

  async function handleCreate() {
    if (pin.length < 5 || !/^\d+$/.test(pin)) {
      setMessage({ text: 'PIN must be 5 or 6 digits', ok: false })
      return
    }
    setSaving(true)
    setMessage(null)
    const res = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, name, role, courseId: courseId || null, pin }),
    })
    const data = await res.json()
    if (data.error) {
      setMessage({ text: data.error, ok: false })
    } else {
      setMessage({ text: `Account created — ${name} logs in at /staff-login with username "${username}" and their PIN`, ok: true })
      setName(''); setUsername(''); setPin(''); setCourseId('')
      router.refresh()
    }
    setSaving(false)
  }

  return (
    <div className="bg-white rounded-xl border p-4 space-y-3 max-w-2xl">
      <h2 className="font-semibold text-sm">Create New User</h2>
      <div className="grid grid-cols-2 gap-2">
        <Input
          placeholder="Full name"
          value={name}
          onChange={e => handleNameChange(e.target.value)}
          className="text-sm"
        />
        <div className="flex items-center gap-1">
          <Input
            placeholder="Username (auto-generated)"
            value={username}
            onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
            className="text-sm"
          />
        </div>
        <Input
          type="password"
          inputMode="numeric"
          placeholder="PIN (5-6 digits)"
          value={pin}
          onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
          className="text-sm tracking-widest"
        />
        <select
          value={role}
          onChange={e => setRole(e.target.value as any)}
          className="text-sm border rounded-lg px-3 py-2 bg-white"
        >
          <option value="student">Student</option>
          <option value="coach">Coach</option>
          <option value="teacher">Teacher</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      {role === 'student' && (
        <select
          value={courseId}
          onChange={e => setCourseId(e.target.value)}
          className="w-full text-sm border rounded-lg px-3 py-2 bg-white"
        >
          <option value="">Assign course (optional)…</option>
          {courses.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      )}
      <p className="text-xs text-muted-foreground">
        Staff &amp; students log in at <span className="font-mono">/staff-login</span> with their username + PIN.
      </p>
      <Button
        onClick={handleCreate}
        disabled={saving || !username || !name || pin.length < 5}
        className="bg-tranmere-blue text-white"
      >
        {saving ? 'Creating…' : 'Create Account'}
      </Button>
      {message && (
        <p className={`text-sm ${message.ok ? 'text-green-700' : 'text-red-600'}`}>{message.text}</p>
      )}
    </div>
  )
}
