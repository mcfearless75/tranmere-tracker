'use client'

// Fallback for /attendance?manual=1 — classic PIN-search flow unchanged.
// This is the original StudentAttendancePage logic preserved for edge cases
// where a student has a PIN but no session pre-selected (e.g. ad-hoc sessions).

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Camera, CheckCircle, AlertCircle, Loader2, ArrowLeft } from 'lucide-react'

type State = 'pin' | 'selfie' | 'submitting' | 'success' | 'error'

export function ManualPin() {
  const supabase   = createClient()
  const router     = useRouter()
  const videoRef   = useRef<HTMLVideoElement>(null)
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const streamRef  = useRef<MediaStream | null>(null)

  const [pin, setPin]                 = useState('')
  const [sessionId, setSessionId]     = useState('')
  const [sessionLabel, setLabel]      = useState('')
  const [state, setState]             = useState<State>('pin')
  const [error, setError]             = useState('')
  const [selfieDataUrl, setSelfie]    = useState<string | null>(null)
  const [geo, setGeo]                 = useState<{ lat: number; lng: number; accuracy: number } | null>(null)
  const [lookingUp, setLookingUp]     = useState(false)

  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        pos => setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
        () => {},
        { enableHighAccuracy: false, timeout: 8000 }
      )
    }
  }, [])

  useEffect(() => {
    if (pin.length !== 6) { setLabel(''); setSessionId(''); return }
    setLookingUp(true)
    supabase
      .from('attendance_sessions')
      .select('id, session_label, pin_code, pin_expires_at')
      .gte('pin_expires_at', new Date().toISOString())
      .then(({ data }) => {
        setLookingUp(false)
        const match = data?.find(s => s.pin_code.toUpperCase() === pin.toUpperCase())
        if (match) { setSessionId(match.id); setLabel(match.session_label) }
        else { setSessionId(''); setLabel('') }
      })
  }, [pin, supabase])

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      streamRef.current = stream
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play() }
    } catch { /* denied */ }
  }
  function stopCamera() { streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null }
  function captureSelfie() {
    if (!videoRef.current || !canvasRef.current) return
    const v = videoRef.current, c = canvasRef.current
    c.width = v.videoWidth; c.height = v.videoHeight
    c.getContext('2d')?.drawImage(v, 0, 0)
    setSelfie(c.toDataURL('image/jpeg', 0.7))
    stopCamera()
  }

  async function submit() {
    setState('submitting')
    let selfiePath: string | null = null
    if (selfieDataUrl) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const blob = await (await fetch(selfieDataUrl)).blob()
        const path = `${user.id}/${sessionId}.jpg`
        const { error: upErr } = await supabase.storage.from('attendance-selfies').upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
        if (!upErr) selfiePath = path
      }
    }
    try {
      const res  = await fetch('/api/attendance/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, pin, geo_lat: geo?.lat ?? null, geo_lng: geo?.lng ?? null, geo_accuracy_m: geo?.accuracy ?? null, selfie_path: selfiePath }),
      })
      const json = await res.json()
      if (!json.ok) { setError(json.error ?? 'Check-in failed'); setState('error'); return }
      stopCamera(); setState('success')
    } catch { setError('Network error — please try again.'); setState('error') }
  }

  if (state === 'pin') return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 space-y-6 max-w-sm mx-auto">
      <button onClick={() => router.push('/attendance')} className="self-start flex items-center gap-1 text-xs text-muted-foreground hover:text-tranmere-blue">
        <ArrowLeft size={13} /> Schedule
      </button>
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold text-tranmere-blue">Check In</h1>
        <p className="text-sm text-muted-foreground">Enter the 6-character PIN shown by your coach</p>
      </div>
      <input type="text" inputMode="text" maxLength={6} placeholder="PIN CODE" value={pin}
        onChange={e => setPin(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
        className="w-full text-center text-3xl font-mono tracking-[0.35em] font-bold border-2 border-tranmere-blue rounded-xl px-4 py-4 focus:outline-none focus:ring-2 focus:ring-tranmere-blue uppercase"
        autoFocus autoComplete="off" autoCorrect="off" />
      {lookingUp && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 size={14} className="animate-spin" /> Checking PIN…</div>}
      {sessionLabel && !lookingUp && (
        <div className="w-full bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-center">
          <p className="text-xs text-green-600 font-medium">Session found</p>
          <p className="font-bold text-green-800">{sessionLabel}</p>
        </div>
      )}
      {pin.length === 6 && !sessionId && !lookingUp && <p className="text-sm text-red-500">PIN not recognised — check the code and try again</p>}
      <button onClick={() => { setState('selfie'); startCamera() }} disabled={!sessionId}
        className="w-full bg-tranmere-blue text-white font-bold py-4 rounded-2xl text-base disabled:opacity-40 active:scale-[0.98] transition-transform">
        Continue →
      </button>
    </div>
  )

  if (state === 'selfie') return (
    <div className="flex flex-col items-center justify-center px-4 space-y-4 max-w-sm mx-auto pt-8">
      <div className="text-center space-y-1">
        <h1 className="text-xl font-bold text-tranmere-blue">Quick selfie</h1>
        <p className="text-sm text-muted-foreground">{sessionLabel}</p>
      </div>
      <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-gray-100 border-2 border-tranmere-blue">
        {selfieDataUrl
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={selfieDataUrl} alt="Selfie" className="w-full h-full object-cover" />
          : <video ref={videoRef} className="w-full h-full object-cover scale-x-[-1]" playsInline muted />}
        <canvas ref={canvasRef} className="hidden" />
      </div>
      {!selfieDataUrl
        ? <button onClick={captureSelfie} className="flex items-center gap-2 bg-tranmere-blue text-white font-bold py-4 px-8 rounded-2xl text-base active:scale-[0.98] transition-transform"><Camera size={20} /> Take Photo</button>
        : <div className="flex gap-3 w-full">
            <button onClick={() => { setSelfie(null); startCamera() }} className="flex-1 border-2 border-tranmere-blue text-tranmere-blue font-semibold py-3.5 rounded-2xl">Retake</button>
            <button onClick={submit} className="flex-1 bg-tranmere-blue text-white font-bold py-3.5 rounded-2xl active:scale-[0.98] transition-transform">Submit ✓</button>
          </div>}
      <button onClick={submit} className="text-xs text-muted-foreground underline">Skip photo and submit</button>
    </div>
  )

  if (state === 'submitting') return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4">
      <Loader2 size={40} className="animate-spin text-tranmere-blue" />
      <p className="text-sm text-muted-foreground">Registering your attendance…</p>
    </div>
  )

  if (state === 'success') return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4 text-center px-4">
      <CheckCircle size={64} className="text-green-500" />
      <h1 className="text-2xl font-bold text-tranmere-blue">You&apos;re in!</h1>
      <p className="text-muted-foreground text-sm">{sessionLabel}</p>
      <p className="text-sm text-muted-foreground">Attendance recorded at {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
      <button onClick={() => router.push('/attendance')} className="mt-2 text-sm text-tranmere-blue underline">Back to schedule</button>
    </div>
  )

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4 text-center px-4">
      <AlertCircle size={48} className="text-red-500" />
      <h1 className="text-xl font-bold text-red-600">Check-in failed</h1>
      <p className="text-sm text-muted-foreground">{error}</p>
      <button onClick={() => { setState('pin'); setError(''); setPin('') }} className="bg-tranmere-blue text-white px-6 py-3 rounded-xl font-semibold">Try again</button>
    </div>
  )
}
