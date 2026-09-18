'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getOrCreateDM } from '@/app/chat/actions'

export function InviteParentForm({
  students,
}: {
  students: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [studentId, setStudentId] = useState(students[0]?.id ?? '')
  const [parentName, setParentName] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [invite, setInvite] = useState<{ login: string; pin: string; studentName: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setBusy(true)
    setError(null)
    setInvite(null)
    const res = await fetch('/api/admin/invite-parent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, parentName, email }),
    })
    const data = await res.json()
    setBusy(false)
    if (!res.ok) setError(data.error ?? 'Failed')
    else {
      setInvite({ login: data.login, pin: data.pin, studentName: data.studentName })
      setParentName('')
      setEmail('')
      router.refresh()
    }
  }

  const text = invite
    ? `Tranmere Tracker parent login\nSite: https://hesolarcampus.com/login\nLogin: ${invite.login}\nPIN: ${invite.pin}\nLinked to ${invite.studentName}`
    : ''

  return (
    <div className="bg-white rounded-xl border p-4 space-y-3">
      <p className="font-semibold">Invite a parent</p>
      <select value={studentId} onChange={e => setStudentId(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
        {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <input value={parentName} onChange={e => setParentName(e.target.value)} placeholder="Parent name" className="w-full border rounded-lg px-3 py-2 text-sm" />
      <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email (optional — used as login if set)" className="w-full border rounded-lg px-3 py-2 text-sm" />
      <button type="button" disabled={busy || !parentName || !studentId} onClick={submit} className="rounded-xl bg-tranmere-blue text-white px-4 py-2 text-sm font-semibold disabled:opacity-50">
        {busy ? 'Creating…' : 'Create login + add to Parents chat'}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {invite && (
        <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 space-y-2">
          <p className="text-sm whitespace-pre-wrap">{text}</p>
          <button type="button" className="text-sm font-semibold text-tranmere-blue" onClick={() => navigator.clipboard.writeText(text)}>
            Copy invite
          </button>
        </div>
      )}
    </div>
  )
}

export function ParentRow({
  parentId,
  name,
  childrenNames,
}: {
  parentId: string
  name: string
  childrenNames: string
}) {
  const [msg, setMsg] = useState<string | null>(null)
  async function dm() {
    const id = await getOrCreateDM(parentId)
    if (typeof id === 'string') window.location.href = `/chat/${id}`
    else setMsg(id.error)
  }
  return (
    <div className="flex items-center justify-between gap-2 py-2">
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{name}</p>
        <p className="text-xs text-muted-foreground truncate">{childrenNames}</p>
      </div>
      <button type="button" onClick={dm} className="text-xs font-semibold text-tranmere-blue shrink-0">Message</button>
      {msg && <p className="text-xs text-red-600">{msg}</p>}
    </div>
  )
}
