'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Camera, CheckCircle, AlertCircle, Loader2, Sun, Moon } from 'lucide-react'

type Props = {
  phase: 'am' | 'pm'
  nfcToken: string
}

type State = 'ready' | 'capturing' | 'submitting' | 'success' | 'error'

export function NfcCheckIn({ phase, nfcToken }: Props) {
  const supabase  = createClient()
  const router    = useRouter()
  const videoRef  = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [state, setState]   = useState<State>('ready')
  const [error, setError]   = useState('')
  const [selfie, setSelfie] = useState<string | null>(null)
  const [geo, setGeo]       = useState<{ lat: number; lng: number; accuracy: number } | null>(null)

  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        pos => setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
        () => {},
        { enableHighAccuracy: true, timeout: 8000 }
      )
    }
  }, [])

  async function startCamera() {
    setState('capturing')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      streamRef.current = stream
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play() }
    } catch { /* skip selfie */ }
  }
  function stopCamera() { streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null }

  function capture() {
    if (!videoRef.current || !canvasRef.current) return
    const v = videoRef.current, c = canvasRef.current
    c.width = v.videoWidth; c.height = v.videoHeight
    c.getContext('2d')?.drawImage(v, 0, 0)
    setSelfie(c.toDataURL('image/jpeg', 0.7))
    stopCamera()
  }

  async function submit() {
    setState('submitting')
    setError('')

    let selfiePath: string | null = null
    if (selfie) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const blob = await (await fetch(selfie)).blob()
        const path = `${user.id}/${new Date().toISOString().split('T')[0]}-${phase}.jpg`
        const { error: upErr } = await supabase.storage.from('attendance-selfies').upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
        if (!upErr) selfiePath = path
      }
    }

    try {
      const res = await fetch('/api/attendance/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phase,
          nfc_token:      nfcToken,
          geo_lat:        geo?.lat ?? null,
          geo_lng:        geo?.lng ?? null,
          geo_accuracy_m: geo?.accuracy ?? null,
          selfie_path:    selfiePath,
        }),
      })
      const json = await res.json()
      if (!json.ok) { setError(json.error ?? 'Check-in failed'); setState('error'); return }
      setState('success')
      setTimeout(() => router.push('/attendance'), 2500)
    } catch {
      setError('Network error — please try again.')
      setState('error')
    }
  }

  const PhaseIcon = phase === 'am' ? Sun : Moon
  const phaseLabel = phase === 'am' ? 'Morning Check-in' : 'End of Day Check-out'

  if (state === 'success') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-3 text-center px-4">
        <CheckCircle size={72} className="text-green-500" />
        <h1 className="text-2xl font-bold text-tranmere-blue">{phase === 'am' ? 'Morning' : 'Evening'} sorted</h1>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    )
  }

  if (state === 'submitting') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4">
        <Loader2 size={40} className="animate-spin text-tranmere-blue" />
        <p className="text-sm text-muted-foreground">Recording attendance…</p>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4 text-center px-4">
        <AlertCircle size={48} className="text-red-500" />
        <h1 className="text-xl font-bold text-red-600">Check-in failed</h1>
        <p className="text-sm text-muted-foreground">{error}</p>
        <button onClick={() => { setState('ready'); setError(''); setSelfie(null) }} className="bg-tranmere-blue text-white px-6 py-3 rounded-xl font-semibold">
          Try again
        </button>
      </div>
    )
  }

  if (state === 'capturing') {
    return (
      <div className="flex flex-col items-center justify-center px-4 space-y-4 max-w-sm mx-auto pt-8">
        <h1 className="text-xl font-bold text-tranmere-blue">Quick selfie</h1>
        <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-gray-100 border-2 border-tranmere-blue">
          {selfie
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={selfie} alt="Selfie" className="w-full h-full object-cover" />
            : <video ref={videoRef} className="w-full h-full object-cover scale-x-[-1]" playsInline muted />}
          <canvas ref={canvasRef} className="hidden" />
        </div>
        {!selfie ? (
          <button onClick={capture} className="flex items-center gap-2 bg-tranmere-blue text-white font-bold py-4 px-8 rounded-2xl text-base active:scale-[0.98] transition-transform">
            <Camera size={20} /> Take Photo
          </button>
        ) : (
          <div className="flex gap-3 w-full">
            <button onClick={() => { setSelfie(null); startCamera() }} className="flex-1 border-2 border-tranmere-blue text-tranmere-blue font-semibold py-3.5 rounded-2xl">Retake</button>
            <button onClick={submit} className="flex-1 bg-tranmere-blue text-white font-bold py-3.5 rounded-2xl active:scale-[0.98] transition-transform">Submit ✓</button>
          </div>
        )}
        <button onClick={submit} className="text-xs text-muted-foreground underline">Skip photo and submit</button>
      </div>
    )
  }

  // ready state
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-5 text-center px-4 max-w-sm mx-auto">
      <div className="w-20 h-20 rounded-full bg-tranmere-blue/10 flex items-center justify-center">
        <PhaseIcon size={40} className="text-tranmere-blue" />
      </div>
      <h1 className="text-2xl font-bold text-tranmere-blue">{phaseLabel}</h1>
      <p className="text-sm text-muted-foreground">
        Tap below, take a quick selfie, and you&apos;re done.
      </p>
      <button
        onClick={startCamera}
        className="w-full bg-tranmere-blue text-white font-bold py-4 rounded-2xl text-base active:scale-[0.98] transition-transform"
      >
        Start check-in
      </button>
    </div>
  )
}
