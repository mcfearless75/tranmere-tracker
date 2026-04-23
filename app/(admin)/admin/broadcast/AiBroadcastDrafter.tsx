'use client'

import { useState } from 'react'
import { Sparkles, Copy, Check } from 'lucide-react'

export function AiBroadcastDrafter() {
  const [brief, setBrief] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function draft() {
    if (!brief.trim()) return
    setLoading(true)
    setError(null)
    const res = await fetch('/api/ai/broadcast-draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brief }),
    })
    const data = await res.json()
    setLoading(false)
    if (data.error) setError(data.error)
    else setMessage(data.message)
  }

  async function copy() {
    await navigator.clipboard.writeText(message)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50 via-white to-indigo-50 p-4 space-y-3">
      <h2 className="font-semibold flex items-center gap-1.5 text-purple-900 text-sm">
        <Sparkles size={15} /> AI Message Drafter
      </h2>
      <p className="text-xs text-muted-foreground">Jot rough notes — AI turns them into a polished broadcast message.</p>

      <textarea
        value={brief}
        onChange={e => setBrief(e.target.value)}
        placeholder="e.g. Remind squad about Tuesday training 6pm Prenton Park, bring training kit and boots, bring water..."
        rows={3}
        className="w-full text-sm border rounded-lg px-3 py-2 resize-none focus:ring-2 focus:ring-purple-400 outline-none bg-white"
      />

      <button
        onClick={draft}
        disabled={loading || !brief.trim()}
        className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2 text-sm font-semibold shadow hover:shadow-lg disabled:opacity-50 transition-shadow"
      >
        <Sparkles size={14} className={loading ? 'animate-spin' : ''} />
        {loading ? 'Drafting…' : 'AI Draft'}
      </button>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>
      )}

      {message && (
        <div className="space-y-2">
          <div className="relative bg-white border border-purple-200 rounded-xl p-4">
            <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed pr-8">{message}</p>
            <button
              onClick={copy}
              className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-purple-50 text-purple-600 transition-colors"
              title="Copy to clipboard"
            >
              {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">Copy and paste into a broadcast channel below ↓</p>
        </div>
      )}
    </div>
  )
}
