'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Course = { id: string; name: string }
type Props = { courses: Course[] }

export function CreateUserForm({ courses }: Props) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'student' | 'coach' | 'teacher' | 'admin'>('student')
  const [courseId, setCourseId] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)

  async function handleCreate() {
    if (password.length < 8) {
      setMessage({ text: 'Password must be at least 8 characters', ok: false })
      return
    }
    setSaving(true)
    setMessage(null)
    const res = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name, role, courseId: courseId || null, password }),
    })
    const data = await res.json()
    if (data.error) {
      setMessage({ text: data.error, ok: false })
    } else {
      setMessage({ text: `Account created for ${name} — they can log in immediately`, ok: true })
      setEmail('')
      setName('')
      setPassword('')
      setCourseId('')
      router.refresh()
    }
    setSaving(false)
  }

  return (
    <div className="bg-white rounded-xl border p-4 space-y-3 max-w-2xl">
      <h2 className="font-semibold text-sm">Create New User</h2>
      <div className="grid grid-cols-2 gap-2">
        <Input placeholder="Full name" value={name} onChange={e => setName(e.target.value)} className="text-sm" />
        <Input type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} className="text-sm" />
        <Input type="password" placeholder="Set a password (min 8 chars)" value={password} onChange={e => setPassword(e.target.value)} className="text-sm" />
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
      <Button
        onClick={handleCreate}
        disabled={saving || !email || !name || !password}
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
