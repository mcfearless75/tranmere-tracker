'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

export default function NotificationsPage() {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  async function handleSend() {
    if (!title.trim() || !body.trim()) return
    setSending(true)
    setResult(null)
    try {
      const res = await fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), body: body.trim(), targetUserIds: null }),
      })
      const data = await res.json()
      if (data.error) {
        setResult(`Error: ${data.error}`)
      } else {
        setResult(`✓ Sent to ${data.sent} device${data.sent !== 1 ? 's' : ''} (${data.failed} failed)`)
        setTitle('')
        setBody('')
      }
    } catch (_err) {
      setResult('Error: network failure')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-6 max-w-lg">
      <h1 className="text-2xl font-bold">Send Notification</h1>
      <p className="text-sm text-muted-foreground">
        Send a push notification to all students who have enabled notifications.
      </p>

      <div className="bg-white rounded-xl border p-4 space-y-3">
        <Input
          placeholder="Notification title"
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="text-sm"
        />
        <Textarea
          placeholder="Message body"
          value={body}
          onChange={e => setBody(e.target.value)}
          rows={3}
          className="text-sm resize-none"
        />
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="px-2 py-1 bg-gray-100 rounded">All Students</span>
          <span>Individual targeting coming soon</span>
        </div>
        <Button
          onClick={handleSend}
          disabled={sending || !title.trim() || !body.trim()}
          className="w-full bg-tranmere-blue text-white py-3"
        >
          {sending ? 'Sending…' : 'Send Push Notification'}
        </Button>
        {result && (
          <p className={`text-sm ${result.startsWith('✓') ? 'text-green-700' : 'text-red-600'}`}>
            {result}
          </p>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <p className="font-semibold mb-1">Automated deadline reminders</p>
        <p>Deadline reminders (7 days and 1 day before due date) are sent automatically via a Supabase scheduled function. See <code>supabase/migrations/002_deadline_cron.sql</code> for setup instructions.</p>
      </div>
    </div>
  )
}
