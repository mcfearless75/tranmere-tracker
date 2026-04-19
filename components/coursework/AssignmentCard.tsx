'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { SubmissionStatus } from '@/lib/utils'
import {
  Circle, Clock, CheckCircle2, Award, Camera, Upload, Link as LinkIcon,
  Send, Trash2, MessageCircle, ChevronDown, ChevronUp, Trophy, AlertCircle,
} from 'lucide-react'

type Props = {
  assignmentId: string
  studentId: string
  title: string
  unitName: string
  dueDate: string
  gradeTarget: string | null
  status: SubmissionStatus
  grade: string | null
  feedback: string | null
}

type Evidence = { id: string; kind: 'file' | 'photo' | 'link'; url: string; filename: string | null; note: string | null; uploaded_at: string }
type Message = { id: string; sender_id: string; sender_role: 'student' | 'staff'; message: string; created_at: string }

const STATUS_CONFIG: Record<SubmissionStatus, { label: string; icon: any; classes: string; activeClasses: string }> = {
  not_started: { label: 'Not started', icon: Circle,       classes: 'bg-gray-50 text-gray-500',    activeClasses: 'bg-gray-200 text-gray-800 ring-2 ring-gray-400' },
  in_progress: { label: 'Working',    icon: Clock,        classes: 'bg-amber-50 text-amber-600',  activeClasses: 'bg-amber-500 text-white ring-2 ring-amber-700' },
  submitted:   { label: 'Submitted',  icon: CheckCircle2, classes: 'bg-blue-50 text-blue-600',    activeClasses: 'bg-tranmere-blue text-white ring-2 ring-blue-900' },
  graded:      { label: 'Graded',     icon: Award,        classes: 'bg-green-50 text-green-600',  activeClasses: 'bg-green-600 text-white ring-2 ring-green-800' },
}

export function AssignmentCard({
  assignmentId, studentId, title, unitName, dueDate, gradeTarget,
  status, grade, feedback,
}: Props) {
  const supabase = createClient()
  const [currentStatus, setCurrentStatus] = useState<SubmissionStatus>(status)
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState(currentStatus === 'graded' || !!feedback)

  const [evidence, setEvidence] = useState<Evidence[]>([])
  const [linkUrl, setLinkUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)

  const [messages, setMessages] = useState<Message[]>([])
  const [showChat, setShowChat] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  const daysUntil = Math.ceil((new Date(dueDate).getTime() - Date.now()) / 86400000)
  const overdue = daysUntil < 0 && ['not_started', 'in_progress'].includes(currentStatus)

  async function getOrCreateSubmissionId(newStatus?: SubmissionStatus): Promise<string | null> {
    const { data } = await supabase
      .from('submissions')
      .upsert({
        assignment_id: assignmentId,
        student_id: studentId,
        status: newStatus ?? currentStatus,
        submitted_at: (newStatus ?? currentStatus) === 'submitted' ? new Date().toISOString() : null,
      }, { onConflict: 'assignment_id,student_id' })
      .select('id')
      .single()
    return data?.id ?? null
  }

  useEffect(() => {
    // Load evidence + messages on mount
    (async () => {
      const { data: sub } = await supabase
        .from('submissions')
        .select('id')
        .eq('assignment_id', assignmentId)
        .eq('student_id', studentId)
        .maybeSingle()

      if (sub?.id) {
        const { data: ev } = await supabase
          .from('submission_evidence')
          .select('*')
          .eq('submission_id', sub.id)
          .order('uploaded_at', { ascending: false })
        setEvidence((ev ?? []) as Evidence[])
      }

      const { data: msgs } = await supabase
        .from('assignment_messages')
        .select('*')
        .eq('assignment_id', assignmentId)
        .eq('student_id', studentId)
        .order('created_at')
      setMessages((msgs ?? []) as Message[])
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId])

  async function updateStatus(newStatus: SubmissionStatus) {
    if (newStatus === 'graded') return
    setSaving(true)
    await getOrCreateSubmissionId(newStatus)
    setCurrentStatus(newStatus)
    setSaving(false)
  }

  async function handleFile(file: File | null, kind: 'file' | 'photo') {
    if (!file) return
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('assignment_id', assignmentId)
    fd.append('kind', kind)
    const res = await fetch('/api/student/evidence', { method: 'POST', body: fd })
    const data = await res.json()
    if (data.error) {
      alert(`Upload failed: ${data.error}`)
      setUploading(false)
      return
    }
    if (data.evidence) setEvidence(prev => [data.evidence as Evidence, ...prev])
    if (currentStatus === 'not_started') setCurrentStatus('in_progress')
    setUploading(false)
  }

  async function addLink() {
    if (!linkUrl.trim()) return
    const url = linkUrl.trim()
    setUploading(true)
    const bumpTo: SubmissionStatus = currentStatus === 'not_started' ? 'in_progress' : currentStatus
    const subId = await getOrCreateSubmissionId(bumpTo)
    if (!subId) { setUploading(false); return }

    const { data: inserted } = await supabase.from('submission_evidence').insert({
      submission_id: subId,
      student_id: studentId,
      kind: 'link',
      url,
      filename: url.replace(/^https?:\/\//, '').slice(0, 60),
    }).select('*').single()
    if (inserted) setEvidence(prev => [inserted as Evidence, ...prev])
    setLinkUrl('')
    setCurrentStatus(bumpTo)
    setUploading(false)
  }

  async function removeEvidence(id: string) {
    if (!confirm('Remove this attachment?')) return
    await supabase.from('submission_evidence').delete().eq('id', id)
    setEvidence(prev => prev.filter(e => e.id !== id))
  }

  async function sendMessage() {
    if (!draft.trim()) return
    setSending(true)
    const { data: inserted } = await supabase.from('assignment_messages').insert({
      assignment_id: assignmentId,
      student_id: studentId,
      sender_id: studentId,
      sender_role: 'student',
      message: draft.trim(),
    }).select('*').single()
    if (inserted) setMessages(prev => [...prev, inserted as Message])
    setDraft('')
    setSending(false)
  }

  const StatusIcon = STATUS_CONFIG[currentStatus].icon

  return (
    <div className={`rounded-2xl border bg-white overflow-hidden ${overdue ? 'border-red-300 ring-1 ring-red-200' : ''}`}>
      {/* HEADER */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-semibold leading-snug">{title}</p>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{unitName}</p>
          </div>
          {gradeTarget && (
            <span className="text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 shrink-0">
              Target {gradeTarget}
            </span>
          )}
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs flex-wrap">
          <span className={overdue ? 'text-red-600 font-semibold' : daysUntil <= 3 && daysUntil >= 0 ? 'text-amber-600 font-semibold' : 'text-muted-foreground'}>
            {overdue ? <><AlertCircle size={11} className="inline -mt-0.5" /> Overdue — {Math.abs(daysUntil)}d ago</> :
              daysUntil === 0 ? '⏰ Due today!' :
              daysUntil === 1 ? 'Due tomorrow' :
              daysUntil < 0 ? `Was due ${Math.abs(daysUntil)}d ago` :
              `Due in ${daysUntil}d`}
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">
            {new Date(dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </span>
        </div>
      </div>

      {/* BIG STATUS BUTTONS */}
      {currentStatus !== 'graded' ? (
        <div className="grid grid-cols-3 gap-0 border-t">
          {(['not_started', 'in_progress', 'submitted'] as SubmissionStatus[]).map((s) => {
            const cfg = STATUS_CONFIG[s]
            const active = currentStatus === s
            const Icon = cfg.icon
            return (
              <button
                key={s}
                onClick={() => updateStatus(s)}
                disabled={saving}
                className={`flex flex-col items-center justify-center gap-0.5 py-3 text-xs font-semibold transition-all ${
                  active ? cfg.activeClasses : 'bg-white hover:bg-gray-50 text-gray-500 border-l first:border-l-0'
                } disabled:opacity-60`}
              >
                <Icon size={16} />
                {cfg.label}
              </button>
            )
          })}
        </div>
      ) : (
        <div className="border-t bg-gradient-to-r from-green-50 via-emerald-50 to-green-50 p-4">
          <div className="flex items-center gap-3">
            <Trophy size={24} className="text-green-600 shrink-0" />
            <div>
              <p className="text-xs uppercase tracking-wider font-bold text-green-800">Graded!</p>
              <p className="text-2xl font-bold text-green-900">{grade ?? '—'}</p>
            </div>
          </div>
          {feedback && (
            <div className="mt-3 bg-white rounded-xl p-3 text-sm border border-green-200">
              <p className="text-[10px] uppercase tracking-wide font-semibold text-green-700 mb-1">Teacher feedback</p>
              <p className="text-gray-800 whitespace-pre-wrap">{feedback}</p>
            </div>
          )}
        </div>
      )}

      {/* EVIDENCE SECTION — collapsed by default, shows count */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 border-t text-xs font-semibold text-muted-foreground hover:bg-gray-50"
      >
        <span className="flex items-center gap-2">
          <Upload size={12} />
          Evidence &amp; files
          {evidence.length > 0 && (
            <span className="bg-tranmere-blue text-white rounded-full px-1.5 py-0.5 text-[10px] font-bold">
              {evidence.length}
            </span>
          )}
          {messages.length > 0 && (
            <span className="bg-purple-500 text-white rounded-full px-1.5 py-0.5 text-[10px] font-bold flex items-center gap-0.5">
              <MessageCircle size={9} /> {messages.length}
            </span>
          )}
        </span>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {expanded && (
        <div className="border-t p-4 space-y-3 bg-gray-50/50">
          {/* Evidence list */}
          {evidence.length > 0 && (
            <div className="space-y-1.5">
              {evidence.map(e => (
                <div key={e.id} className="flex items-center gap-2 bg-white rounded-lg p-2 border text-xs">
                  {e.kind === 'photo' ? <Camera size={14} className="text-tranmere-blue shrink-0" /> :
                   e.kind === 'link' ? <LinkIcon size={14} className="text-purple-500 shrink-0" /> :
                   <Upload size={14} className="text-gray-500 shrink-0" />}
                  <a
                    href={e.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 min-w-0 truncate text-tranmere-blue hover:underline"
                  >
                    {e.filename ?? e.url}
                  </a>
                  {currentStatus !== 'graded' && (
                    <button
                      onClick={() => removeEvidence(e.id)}
                      className="text-red-400 hover:text-red-600 shrink-0 p-0.5"
                      aria-label="Remove"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Upload buttons */}
          {currentStatus !== 'graded' && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => cameraRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-tranmere-blue text-white px-3 py-2.5 text-sm font-semibold shadow active:scale-95 disabled:opacity-50"
                >
                  <Camera size={14} /> Take Photo
                </button>
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center justify-center gap-1.5 rounded-xl border-2 border-tranmere-blue text-tranmere-blue bg-white px-3 py-2.5 text-sm font-semibold active:scale-95 disabled:opacity-50"
                >
                  <Upload size={14} /> Upload File
                </button>
              </div>
              <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={e => handleFile(e.target.files?.[0] ?? null, 'photo')}
              />
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.doc,.docx,.odt,.txt,.rtf,image/*"
                className="hidden"
                onChange={e => handleFile(e.target.files?.[0] ?? null, 'file')}
              />

              <div className="flex gap-2">
                <input
                  value={linkUrl}
                  onChange={e => setLinkUrl(e.target.value)}
                  placeholder="Paste Google Doc / OneDrive link…"
                  className="flex-1 text-sm border rounded-lg px-3 py-2 bg-white"
                />
                <button
                  onClick={addLink}
                  disabled={uploading || !linkUrl.trim()}
                  className="rounded-lg bg-purple-500 text-white px-3 py-2 text-sm font-semibold hover:bg-purple-600 disabled:opacity-50 flex items-center gap-1"
                >
                  <LinkIcon size={13} /> Add
                </button>
              </div>

              {uploading && <p className="text-xs text-muted-foreground text-center">Uploading…</p>}
            </>
          )}

          {/* Chat toggle */}
          <button
            onClick={() => setShowChat(v => !v)}
            className="w-full flex items-center justify-center gap-1.5 text-xs text-tranmere-blue font-semibold pt-2"
          >
            <MessageCircle size={12} />
            {showChat ? 'Hide' : messages.length > 0 ? `View ${messages.length} message${messages.length > 1 ? 's' : ''}` : 'Ask a question'}
          </button>

          {showChat && (
            <div className="bg-white rounded-xl border p-3 space-y-2">
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {messages.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    Stuck? Send your teacher a question about this assignment.
                  </p>
                )}
                {messages.map(m => (
                  <div
                    key={m.id}
                    className={`flex ${m.sender_role === 'student' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] px-3 py-1.5 rounded-2xl text-sm ${
                        m.sender_role === 'student'
                          ? 'bg-tranmere-blue text-white rounded-br-md'
                          : 'bg-gray-100 text-gray-900 rounded-bl-md'
                      }`}
                    >
                      <p>{m.message}</p>
                      <p className={`text-[10px] mt-0.5 ${m.sender_role === 'student' ? 'text-blue-200' : 'text-gray-500'}`}>
                        {m.sender_role === 'staff' ? '👩‍🏫 Teacher' : 'You'} · {new Date(m.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-1.5 pt-2 border-t">
                <input
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                  placeholder="Type a question…"
                  className="flex-1 text-sm border rounded-lg px-3 py-2"
                />
                <button
                  onClick={sendMessage}
                  disabled={sending || !draft.trim()}
                  className="rounded-lg bg-tranmere-blue text-white px-3 py-2 disabled:opacity-50"
                >
                  <Send size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
