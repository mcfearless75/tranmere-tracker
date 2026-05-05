'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Camera, CheckCircle, AlertCircle, Loader2, ArrowLeft } from 'lucide-react'

type FlowSession = {
  id: string
  session_label: string
  session_type: string
  pin_code: string
  pin_expires_at: string
  opens_at: string
  closes_at: string | null
}

type Props = {
  session: FlowSession
  existingRecord: { id: string; checked_in_at: string } | null
}

type State = 'pin' | 'selfie' | 'submitting' | 'success' | 'error'

export function CheckInFlow({ session, existingRecord }: Props) {
  const supabase   = createClient()
  const router     = useRouter()
  const videoRef   = useRef<HTMLVideoElement>(null)
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const streamRef  = useRef<MediaStream | null>(null)

  const [state, setState]           = useState<State>(existingRecord ? 'success' : 'pin')
  const [pin, setPin]               = useState('')
  const [pinError, setPinError]     = useState('')
  const [selfieDataUrl, setSelfie]  = useState<string | null>(null)
  const [error, setError]           = useState('')
  const [geo, setGeo]               = useState<{ lat: number; lng: number; accuracy: number } | null>(null)

  // Silent GPS grab
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        pos => setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
        () => {},
        { enableHighAccuracy: false, timeout: 8000 }
      )
    }
  }, [])

  // Camera helpers
  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      streamRef.current = stream
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play() }
    } catch { /* camera denied — continue without selfie */ }
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

  // Verify PIN against this specific session
  function verifyPin() {
    const pinValid  = session.pin_code.toUpperCase() === pin.toUpperCase()
    const notExpired = new Date(session.pin_expires_at) > new Date()

    if (!notExpired) {
      setPinError('PIN has expired — ask your coach to rotate it')
      return
    }
    if (!pinValid) {
      setPinError('Incorrect PIN — check the code and try again')
      return
    }
    setPinError('')
    setState('selfie')
    startCamera()
  }

  async function submit() {
    setState('submitting')
    setError('')

    let selfiePath: string | null = null
    if (selfieDataUrl) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const blob = await (await fetch(selfieDataUrl)).blob()
        const path = `${user.id}/${session.id}.jpg`
        const { error: upErr } = await supabase.storage
          .from('attendance-selfies')
          .upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
        if (!upErr) selfiePath = path
      }
    }

    try {
      const res  = await fetch('/api/attendance/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id:      session.id,
          pin,
          geo_lat:         geo?.lat ?? null,
          geo_lng:         geo?.lng ?? null,
          geo_accuracy_m:  geo?.accuracy ?? null,
          selfie_path:     selfiePath,
        }),
      })
      const json = await res.json()
      if (!json.ok) { setError(json.error ?? 'Check-in failed'); setState('error'); return }
      stopCamera()
      setState('success')
    } catch {
      setError('Network error — please try again.')
      setState('error')
    }
  }

  // ── Already checked in ───────────────────────────────────────────────────────
  if (state === 'success') {
    const checkedAt = existingRecord
      ? new Date(existingRecord.checked_in_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
      : new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4 text-center px-4">
        <CheckCircle size={64} className="text-green-500" />
        <h1 className="text-2xl font-bold text-tranmere-blue">You&apos;re in!</h1>
        <p className="font-semibold">{session.session_label}</p>
        <p className="text-sm text-muted-foreground">Attendance recorded at {checkedAt}</p>
        <button
          onClick={() => router.push('/attendance')}
          className="mt-2 text-sm text-tranmere-blue underline"
        >
          Back to schedule
        </button>
      </div>
    )
  }

  // ── PIN entry ────────────────────────────────────────────────────────────────
  if (state === 'pin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 space-y-5 max-w-sm mx-auto">
        <button
          onClick={() => router.push('/attendance')}
          className="self-start flex items-center gap-1 text-xs text-muted-foreground hover:text-tranmere-blue"
        >
          <ArrowLeft size={13} /> Schedule
        </button>

        {/* Session context */}
        <div className="w-full bg-tranmere-blue/5 border border-tranmere-blue/20 rounded-2xl px-4 py-3 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">{session.session_type}</p>
          <p className="font-bold text-tranmere-blue">{session.session_label}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {new Date(session.opens_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            {session.closes_at && ` – ${new Date(session.closes_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`}
          </p>
        </div>

        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold text-tranmere-blue">Enter PIN</h1>
          <p className="text-sm text-muted-foreground">Type the 6-character code shown by your coach</p>
        </div>

        <input
          type="text"
          inputMode="text"
          maxLength={6}
          placeholder="PIN CODE"
          value={pin}
          onChange={e => { setPin(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')); setPinError('') }}
          className="w-full text-center text-3xl font-mono tracking-[0.35em] font-bold border-2 border-tranmere-blue rounded-xl px-4 py-4 focus:outline-none focus:ring-2 focus:ring-tranmere-blue uppercase"
          autoFocus autoComplete="off" autoCorrect="off"
        />

        {pinError && <p className="text-sm text-red-500 text-center">{pinError}</p>}

        <button
          onClick={verifyPin}
          disabled={pin.length < 6}
          className="w-full bg-tranmere-blue text-white font-bold py-4 rounded-2xl text-base disabled:opacity-40 active:scale-[0.98] transition-transform"
        >
          Continue →
        </button>
      </div>
    )
  }

  // ── Selfie ───────────────────────────────────────────────────────────────────
  if (state === 'selfie') {
    return (
      <div className="flex flex-col items-center justify-center px-4 space-y-4 max-w-sm mx-auto pt-8">
        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold text-tranmere-blue">Quick selfie</h1>
          <p className="text-sm text-muted-foreground">{session.session_label}</p>
        </div>

        <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-gray-100 border-2 border-tranmere-blue">
          {selfieDataUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={selfieDataUrl} alt="Selfie" className="w-full h-full object-cover" />
            : <video ref={videoRef} className="w-full h-full object-cover scale-x-[-1]" playsInline muted />
          }
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {!selfieDataUrl ? (
          <button
            onClick={captureSelfie}
            className="flex items-center gap-2 bg-tranmere-blue text-white font-bold py-4 px-8 rounded-2xl text-base active:scale-[0.98] transition-transform"
          >
            <Camera size={20} /> Take Photo
          </button>
        ) : (
          <div className="flex gap-3 w-full">
            <button onClick={() => { setSelfie(null); startCamera() }} className="flex-1 border-2 border-tranmere-blue text-tranmere-blue font-semibold py-3.5 rounded-2xl">
              Retake
            </button>
            <button onClick={submit} className="flex-1 bg-tranmere-blue text-white font-bold py-3.5 rounded-2xl active:scale-[0.98] transition-transform">
              Submit ✓
            </button>
          </div>
        )}

        <button onClick={submit} className="text-xs text-muted-foreground underline">
          Skip photo and submit
        </button>
      </div>
    )
  }

  // ── Submitting ───────────────────────────────────────────────────────────────
  if (state === 'submitting') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4">
        <Loader2 size={40} className="animate-spin text-tranmere-blue" />
        <p className="text-sm text-muted-foreground">Registering your attendance…</p>
      </div>
    )
  }

  // ── Error ────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4 text-center px-4">
      <AlertCircle size={48} className="text-red-500" />
      <h1 className="text-xl font-bold text-red-600">Check-in failed</h1>
      <p className="text-sm text-muted-foreground">{error}</p>
      <button
        onClick={() => { setState('pin'); setError(''); setPin('') }}
        className="bg-tranmere-blue text-white px-6 py-3 rounded-xl font-semibold"
      >
        Try again
      </button>
    </div>
  )
}
