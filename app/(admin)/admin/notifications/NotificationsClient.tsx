'use client'

import { useState, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Bell, Users, Search, Check, X } from 'lucide-react'

type User = {
  id: string
  name: string | null
  role: string
  course_id: string | null
  avatar_url: string | null
  subscribed: boolean
}
type Course = { id: string; name: string }

type Audience =
  | { kind: 'all' }
  | { kind: 'role'; role: string }
  | { kind: 'course'; courseId: string }
  | { kind: 'individuals'; ids: string[] }

const ROLE_OPTIONS = [
  { value: 'student', label: 'All Students' },
  { value: 'coach', label: 'All Coaches' },
  { value: 'teacher', label: 'All Teachers' },
  { value: 'admin', label: 'All Admins' },
]

const TEMPLATES = [
  { icon: '📚', title: 'Coursework reminder', body: "Don't forget to submit your coursework by the deadline!" },
  { icon: '⚽', title: 'Training tomorrow', body: 'Training session tomorrow at the usual time. See you on the pitch!' },
  { icon: '🏆', title: 'Match day!', body: 'Big match today. Check your squad list and be ready.' },
  { icon: '🍎', title: 'Nutrition check-in', body: 'Have you logged your food today? Keep on top of your goals.' },
]

export function NotificationsClient({ users, courses }: { users: User[]; courses: Course[] }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [audience, setAudience] = useState<Audience>({ kind: 'role', role: 'student' })
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)

  // Calculate who will receive the notification
  const targetedUsers = useMemo(() => {
    let base: User[]
    if (audience.kind === 'all') base = users
    else if (audience.kind === 'role') base = users.filter(u => u.role === audience.role)
    else if (audience.kind === 'course') base = users.filter(u => u.course_id === audience.courseId)
    else base = users.filter(u => selectedIds.has(u.id))
    return base
  }, [audience, selectedIds, users])

  const subscribedCount = targetedUsers.filter(u => u.subscribed).length

  const filteredList = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return users
    return users.filter(u => (u.name ?? '').toLowerCase().includes(q))
  }, [search, users])

  function toggleIndividual(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function applyTemplate(t: typeof TEMPLATES[number]) {
    setTitle(t.title)
    setBody(t.body)
  }

  async function send() {
    if (!title.trim() || !body.trim()) return
    setSending(true)
    setResult(null)

    const targetUserIds = audience.kind === 'all' ? null : targetedUsers.map(u => u.id)

    const res = await fetch('/api/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title.trim(), body: body.trim(), targetUserIds }),
    })
    const data = await res.json()
    setSending(false)
    if (data.error) {
      setResult({ ok: false, text: `Error: ${data.error}` })
    } else {
      setResult({
        ok: true,
        text: `Sent to ${data.sent} device(s)${data.failed > 0 ? ` · ${data.failed} failed` : ''} · ${data.total} subscribers targeted`,
      })
      setTitle(''); setBody('')
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* LEFT — compose */}
      <div className="lg:col-span-2 space-y-5">
        {/* Templates */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Quick Templates</p>
          <div className="grid grid-cols-2 gap-2">
            {TEMPLATES.map(t => (
              <button
                key={t.title}
                onClick={() => applyTemplate(t)}
                className="flex items-center gap-2 rounded-xl border bg-white hover:border-tranmere-blue hover:bg-blue-50 p-3 text-left text-sm transition"
              >
                <span className="text-xl">{t.icon}</span>
                <div className="min-w-0">
                  <p className="font-semibold truncate">{t.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{t.body}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Message */}
        <div className="rounded-2xl border bg-white p-5 space-y-3">
          <p className="font-semibold">Message</p>
          <Input
            placeholder="Notification title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            maxLength={60}
          />
          <Textarea
            placeholder="Message body"
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={3}
            maxLength={200}
            className="resize-none"
          />
          <p className="text-xs text-muted-foreground">
            {title.length}/60 · {body.length}/200
          </p>
        </div>

        {/* Preview */}
        {(title || body) && (
          <div className="rounded-2xl border bg-gray-900 p-4 text-white">
            <p className="text-xs uppercase tracking-widest text-gray-400 mb-2">Preview</p>
            <div className="bg-gray-800 rounded-xl p-3 flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-tranmere-blue flex items-center justify-center shrink-0">
                <Bell size={18} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{title || 'Notification title'}</p>
                <p className="text-xs text-gray-300 line-clamp-2">{body || 'Message body will appear here'}</p>
                <p className="text-xs text-gray-500 mt-1">Tranmere Tracker · now</p>
              </div>
            </div>
          </div>
        )}

        {/* Send */}
        <div className="rounded-2xl border bg-white p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm">
              <span className="font-semibold">{targetedUsers.length}</span> recipient{targetedUsers.length !== 1 ? 's' : ''}
              <span className="text-muted-foreground"> · </span>
              <span className="font-semibold text-green-600">{subscribedCount}</span>
              <span className="text-muted-foreground"> subscribed</span>
            </p>
          </div>
          <Button
            onClick={send}
            disabled={sending || !title.trim() || !body.trim() || subscribedCount === 0}
            className="w-full bg-tranmere-blue hover:bg-blue-900 text-white h-12 text-base"
          >
            <Bell size={16} className="mr-2" />
            {sending ? 'Sending…' : `Send to ${subscribedCount} device${subscribedCount !== 1 ? 's' : ''}`}
          </Button>
          {result && (
            <div className={`rounded-lg p-3 text-sm flex items-start gap-2 ${
              result.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'
            }`}>
              {result.ok ? <Check size={16} className="mt-0.5 shrink-0" /> : <X size={16} className="mt-0.5 shrink-0" />}
              <span>{result.text}</span>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT — audience */}
      <div className="rounded-2xl border bg-white p-5 space-y-4 h-fit lg:sticky lg:top-6">
        <div>
          <p className="font-semibold flex items-center gap-1.5 mb-3">
            <Users size={16} className="text-tranmere-blue" /> Audience
          </p>

          {/* Audience mode selector */}
          <div className="space-y-1">
            <button
              onClick={() => setAudience({ kind: 'all' })}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${
                audience.kind === 'all' ? 'bg-tranmere-blue text-white' : 'hover:bg-gray-50'
              }`}
            >
              Everyone
            </button>

            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-3 pb-1 px-1">By Role</p>
            {ROLE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setAudience({ kind: 'role', role: opt.value })}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${
                  audience.kind === 'role' && audience.role === opt.value ? 'bg-tranmere-blue text-white' : 'hover:bg-gray-50'
                }`}
              >
                {opt.label}
              </button>
            ))}

            {courses.length > 0 && (
              <>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-3 pb-1 px-1">By Course</p>
                {courses.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setAudience({ kind: 'course', courseId: c.id })}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${
                      audience.kind === 'course' && audience.courseId === c.id ? 'bg-tranmere-blue text-white' : 'hover:bg-gray-50'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </>
            )}

            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-3 pb-1 px-1">Individual</p>
            <button
              onClick={() => setAudience({ kind: 'individuals', ids: [] })}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${
                audience.kind === 'individuals' ? 'bg-tranmere-blue text-white' : 'hover:bg-gray-50'
              }`}
            >
              Pick specific people ({selectedIds.size})
            </button>
          </div>
        </div>

        {/* Individual picker */}
        {audience.kind === 'individuals' && (
          <div className="space-y-2 pt-3 border-t">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
              {filteredList.map(u => {
                const initials = (u.name ?? '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                const selected = selectedIds.has(u.id)
                return (
                  <button
                    key={u.id}
                    onClick={() => toggleIndividual(u.id)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition ${
                      selected ? 'bg-blue-50 ring-1 ring-tranmere-blue' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
                      selected ? 'bg-tranmere-blue text-white' : 'bg-gray-200 text-gray-600'
                    }`}>
                      {selected ? <Check size={12} /> : initials}
                    </div>
                    <span className="flex-1 text-left truncate">{u.name ?? '(no name)'}</span>
                    {u.subscribed ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500" title="Push enabled" />
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-300" title="Push disabled" />
                    )}
                  </button>
                )
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 mr-1" /> = has push enabled
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
