'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { CheckCircle, AlertTriangle, UserX, RefreshCw, ChevronDown, ChevronUp, MapPin, Wifi, Image as ImageIcon } from 'lucide-react'
import Link from 'next/link'

type Student = { id: string; name: string; avatar_url: string | null }
type Record = {
  id: string
  checked_in_at: string
  method: string
  is_flagged: boolean
  flag_reason: string | null
  client_ip: string | null
  geo_lat: number | null
  geo_lng: number | null
  geo_accuracy_m: number | null
  selfie_path: string | null
  users: Student | null
}
type Session = {
  id: string
  session_label: string
  session_type: string
  pin_code: string
  pin_expires_at: string
  opens_at: string
  closes_at: string | null
}

type Props = {
  session: Session
  initialRecords: Record[]
  allStudents: Student[]
  coachId: string
}

export function AttendanceLive({ session, initialRecords, allStudents, coachId: _coachId }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [records, setRecords] = useState<Record[]>(initialRecords)
  const [pin, setPin] = useState(session.pin_code)
  const [expiresAt, setExpiresAt] = useState(new Date(session.pin_expires_at))
  const [secsLeft, setSecsLeft] = useState(0)
  const [rotating, setRotating] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [closingSession, setClosingSession] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Countdown timer ────────────────────────────────────────────────────────
  useEffect(() => {
    function tick() {
      const secs = Math.max(0, Math.round((expiresAt.getTime() - Date.now()) / 1000))
      setSecsLeft(secs)
    }
    tick()
    intervalRef.current = setInterval(tick, 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [expiresAt])

  // ── Real-time roster updates ───────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel(`attendance:${session.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'attendance_records', filter: `session_id=eq.${session.id}` },
        payload => {
          const row = payload.new as any
          // Fetch enriched record (includes student name)
          supabase
            .from('attendance_records')
            .select('id, checked_in_at, method, is_flagged, flag_reason, client_ip, geo_lat, geo_lng, geo_accuracy_m, selfie_path, users:student_id(id,name,avatar_url)')
            .eq('id', row.id)
            .single()
            .then(({ data }) => {
              if (data) setRecords(prev => [...prev.filter(r => r.id !== data.id), data as unknown as Record])
            })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [session.id, supabase])

  // ── Rotate PIN ─────────────────────────────────────────────────────────────
  const rotatePin = useCallback(async () => {
    setRotating(true)
    const { data, error } = await supabase.rpc('rotate_attendance_pin', { p_session_id: session.id })
    if (!error && data) {
      setPin(data)
      setExpiresAt(new Date(Date.now() + 2 * 60 * 1000))
    }
    setRotating(false)
  }, [session.id, supabase])

  // ── Close session ──────────────────────────────────────────────────────────
  async function closeSession() {
    setClosingSession(true)
    await supabase.from('attendance_sessions').update({ closes_at: new Date().toISOString() }).eq('id', session.id)
    router.push('/admin/attendance')
  }

  // ── Manual mark ───────────────────────────────────────────────────────────
  async function manualMark(studentId: string, present: boolean) {
    await supabase.rpc('mark_attendance_manual', {
      p_session_id: session.id,
      p_student_id: studentId,
      p_present: present,
    })
    router.refresh()
  }

  // ── Selfie URL ─────────────────────────────────────────────────────────────
  function selfieUrl(path: string) {
    const { data } = supabase.storage.from('attendance-selfies').getPublicUrl(path)
    return data.publicUrl
  }

  const checkedInIds = new Set(records.map(r => r.users?.id))
  const absentStudents = allStudents.filter(s => !checkedInIds.has(s.id))
  const flaggedCount = records.filter(r => r.is_flagged).length

  const pct = Math.max(0, (secsLeft / 120) * 100)
  const barColor = secsLeft > 30 ? 'bg-green-500' : secsLeft > 10 ? 'bg-amber-400' : 'bg-red-500'

  return (
    <div className="space-y-4 max-w-xl">
      {/* Back */}
      <Link href="/admin/attendance" className="text-xs text-muted-foreground hover:text-tranmere-blue">
        ← All Sessions
      </Link>

      {/* PIN Display */}
      <div className="bg-tranmere-blue rounded-2xl p-6 text-white space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-200 text-xs uppercase tracking-wider">{session.session_type}</p>
            <p className="font-bold text-lg leading-tight">{session.session_label}</p>
          </div>
          {flaggedCount > 0 && (
            <span className="flex items-center gap-1 bg-amber-400 text-black text-xs font-bold px-2 py-1 rounded-full">
              <AlertTriangle size={11} /> {flaggedCount} flagged
            </span>
          )}
        </div>

        <div className="bg-white/10 rounded-xl p-4 text-center space-y-2">
          <p className="text-blue-200 text-xs uppercase tracking-widest">Check-in PIN</p>
          <p className="text-5xl font-black tracking-[0.25em] font-mono">{pin}</p>

          {/* Countdown bar */}
          <div className="w-full bg-white/20 rounded-full h-2 overflow-hidden">
            <div className={`h-2 rounded-full transition-all duration-1000 ${barColor}`} style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-blue-200">
            {secsLeft > 0 ? `Expires in ${secsLeft}s` : 'PIN expired — rotate now'}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={rotatePin}
            disabled={rotating}
            className="flex-1 flex items-center justify-center gap-1.5 bg-white/20 hover:bg-white/30 rounded-xl py-2.5 text-sm font-semibold transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={rotating ? 'animate-spin' : ''} />
            {rotating ? 'Rotating…' : 'Rotate PIN'}
          </button>
          <button
            onClick={closeSession}
            disabled={closingSession}
            className="flex-1 flex items-center justify-center gap-1.5 bg-red-500/80 hover:bg-red-500 rounded-xl py-2.5 text-sm font-semibold transition-colors"
          >
            {closingSession ? 'Closing…' : 'Close Session'}
          </button>
        </div>
      </div>

      {/* Roster — Checked In */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <p className="font-semibold text-sm flex items-center gap-1.5">
            <CheckCircle size={15} className="text-green-500" />
            Checked In
            <span className="text-muted-foreground font-normal">({records.length})</span>
          </p>
        </div>

        {records.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Waiting for students…</p>
        ) : (
          <ul className="divide-y">
            {records.map(r => (
              <li key={r.id}>
                <button
                  onClick={() => setExpanded(prev => prev === r.id ? null : r.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                >
                  {r.users?.avatar_url
                    ? <img src={r.users.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                    : <div className="w-8 h-8 rounded-full bg-tranmere-blue/10 flex items-center justify-center text-tranmere-blue text-xs font-bold shrink-0">
                        {r.users?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                  }
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{r.users?.name ?? 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(r.checked_in_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      {r.method === 'manual' && <span className="ml-1 text-blue-500">· manual</span>}
                    </p>
                  </div>
                  {r.is_flagged && (
                    <span className="shrink-0 flex items-center gap-1 text-amber-600 text-xs font-medium bg-amber-50 px-2 py-0.5 rounded-full">
                      <AlertTriangle size={11} /> Flagged
                    </span>
                  )}
                  {expanded === r.id ? <ChevronUp size={14} className="text-muted-foreground shrink-0" /> : <ChevronDown size={14} className="text-muted-foreground shrink-0" />}
                </button>

                {/* Expanded audit trail */}
                {expanded === r.id && (
                  <div className="px-4 pb-4 bg-gray-50 border-t space-y-2">
                    {r.is_flagged && (
                      <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-2 mt-2">
                        <AlertTriangle size={14} className="text-amber-600 mt-0.5 shrink-0" />
                        <p className="text-xs text-amber-800">{r.flag_reason}</p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {r.client_ip && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Wifi size={12} /> {r.client_ip}
                        </div>
                      )}
                      {r.geo_lat && r.geo_lng && (
                        <a
                          href={`https://maps.google.com/?q=${r.geo_lat},${r.geo_lng}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 text-xs text-blue-600 underline"
                        >
                          <MapPin size={12} /> View on map
                        </a>
                      )}
                    </div>
                    {r.selfie_path && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                          <ImageIcon size={11} aria-hidden="true" /> Selfie at check-in
                        </p>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={selfieUrl(r.selfie_path)}
                          alt="Check-in selfie"
                          className="w-24 h-24 object-cover rounded-lg border"
                        />
                      </div>
                    )}
                    <button
                      onClick={() => manualMark(r.users!.id, false)}
                      className="text-xs text-red-500 underline mt-1"
                    >
                      Mark absent
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Absent students */}
      {absentStudents.length > 0 && (
        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b">
            <p className="font-semibold text-sm flex items-center gap-1.5">
              <UserX size={15} className="text-red-400" />
              Not Checked In
              <span className="text-muted-foreground font-normal">({absentStudents.length})</span>
            </p>
          </div>
          <ul className="divide-y">
            {absentStudents.map(s => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="w-7 h-7 rounded-full bg-red-50 flex items-center justify-center text-red-400 text-xs font-bold shrink-0">
                  {s.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <p className="text-sm flex-1">{s.name}</p>
                <button
                  onClick={() => manualMark(s.id, true)}
                  className="text-xs text-tranmere-blue underline"
                >
                  Mark present
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
