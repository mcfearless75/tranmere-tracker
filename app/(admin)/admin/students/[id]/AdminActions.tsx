'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { KeyRound, Trash2, Shield, Bell } from 'lucide-react'

type Props = {
  userId: string
  userName: string
  email: string
}

function extractUsername(email: string) {
  return email.split('@')[0]
}

export function AdminActions({ userId, userName, email }: Props) {
  const router = useRouter()
  const [newPin, setNewPin] = useState('')
  const [resetting, setResetting] = useState(false)
  const [resetMsg, setResetMsg] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testMsg, setTestMsg] = useState<string | null>(null)

  async function resetPin() {
    if (!/^\d{5,6}$/.test(newPin)) {
      setResetMsg('PIN must be 5 or 6 digits')
      return
    }
    setResetting(true)
    setResetMsg(null)
    const res = await fetch('/api/admin/reset-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, newPin }),
    })
    const data = await res.json()
    setResetting(false)
    if (data.error) {
      setResetMsg(`Error: ${data.error}`)
    } else {
      setResetMsg(data.message)
      setNewPin('')
    }
  }

  async function deleteUser() {
    if (!confirm(`Permanently delete ${userName}? This removes their account, coursework progress, GPS data and match records. This cannot be undone.`)) return
    if (!confirm(`Are you absolutely sure? Type "delete" in the next prompt to confirm.`)) return
    const final = prompt(`Type "delete" to confirm removal of ${userName}`)
    if (final !== 'delete') return

    setDeleting(true)
    const res = await fetch('/api/admin/delete-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
    const data = await res.json()
    if (data.error) {
      alert(`Error: ${data.error}`)
      setDeleting(false)
    } else {
      router.push('/admin/users')
      router.refresh()
    }
  }

  async function sendTestPush() {
    setTesting(true)
    setTestMsg(null)
    const res = await fetch('/api/admin/send-reminder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId: userId,
        title: `Hey ${userName.split(' ')[0]}!`,
        body: 'Your coach is checking in. Open the app to see your latest stats.',
        url: '/dashboard',
      }),
    })
    const data = await res.json()
    setTesting(false)
    setTestMsg(data.message ?? data.error ?? 'Sent')
  }

  const username = extractUsername(email)

  return (
    <div className="rounded-2xl border bg-white p-5 space-y-5">
      <div className="flex items-center gap-2">
        <Shield size={16} className="text-tranmere-blue" />
        <h2 className="font-semibold">Admin Actions</h2>
      </div>

      {/* Login info */}
      <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-sm">
        <p className="font-semibold text-tranmere-blue mb-1">Login credentials</p>
        <p className="text-xs text-blue-700">
          Page: <span className="font-mono bg-white px-1.5 py-0.5 rounded">/staff-login</span>
        </p>
        <p className="text-xs text-blue-700 mt-1">
          Username: <span className="font-mono bg-white px-1.5 py-0.5 rounded">{username}</span>
        </p>
      </div>

      {/* Reset PIN */}
      <div className="space-y-2">
        <label className="text-sm font-medium flex items-center gap-1.5">
          <KeyRound size={14} /> Reset PIN
        </label>
        <div className="flex gap-2">
          <Input
            type="password"
            inputMode="numeric"
            placeholder="New PIN (5-6 digits)"
            value={newPin}
            onChange={e => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="flex-1 text-sm tracking-widest text-center"
          />
          <button
            onClick={resetPin}
            disabled={resetting || newPin.length < 5}
            className="rounded-lg bg-tranmere-blue text-white px-4 py-2 text-sm font-medium hover:bg-blue-900 disabled:opacity-50"
          >
            {resetting ? 'Resetting…' : 'Reset'}
          </button>
        </div>
        {resetMsg && (
          <p className={`text-xs ${resetMsg.startsWith('Error') ? 'text-red-600' : 'text-green-700'}`}>{resetMsg}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Enter a new PIN. The student can immediately log in with it. Tell them in person — no email is sent.
        </p>
      </div>

      {/* Send test push */}
      <div className="space-y-2">
        <label className="text-sm font-medium flex items-center gap-1.5">
          <Bell size={14} /> Send Test Notification
        </label>
        <button
          onClick={sendTestPush}
          disabled={testing}
          className="w-full rounded-lg border border-tranmere-blue text-tranmere-blue px-4 py-2 text-sm font-medium hover:bg-blue-50 disabled:opacity-50"
        >
          {testing ? 'Sending…' : 'Send test push notification'}
        </button>
        {testMsg && <p className="text-xs text-muted-foreground">{testMsg}</p>}
      </div>

      {/* Delete */}
      <div className="pt-3 border-t">
        <label className="text-sm font-medium flex items-center gap-1.5 text-red-600 mb-2">
          <Trash2 size={14} /> Danger Zone
        </label>
        <button
          onClick={deleteUser}
          disabled={deleting}
          className="w-full rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-2 text-sm font-medium hover:bg-red-100 disabled:opacity-50"
        >
          {deleting ? 'Deleting…' : `Delete ${userName}`}
        </button>
        <p className="text-xs text-muted-foreground mt-2">
          Removes the account and all associated data (coursework, GPS, matches). Cannot be undone.
        </p>
      </div>
    </div>
  )
}
