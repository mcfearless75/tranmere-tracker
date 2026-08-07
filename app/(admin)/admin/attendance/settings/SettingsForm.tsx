'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, CheckCircle2, Eye, EyeOff, Sun, UtensilsCrossed, Moon, MapPin } from 'lucide-react'
import { validateWindows, validateGeo } from '@/lib/attendance/windowValidation'

type FormValues = {
  am_window_start: string
  am_window_end: string
  lunch_window_start: string
  lunch_window_end: string
  pm_window_start: string
  pm_window_end: string
  geo_lat: number
  geo_lng: number
  radius_m: number
}

// Numeric fields hold the raw input string while the user types.
type FormState = Omit<FormValues, 'geo_lat' | 'geo_lng' | 'radius_m'> & {
  geo_lat: number | string
  geo_lng: number | string
  radius_m: number | string
}

export function SettingsForm({
  initial,
  nfcToken,
}: {
  initial: FormValues
  /** Only ever non-null for role 'admin' — staff below admin never receive it. */
  nfcToken: string | null
}) {
  const router = useRouter()
  const [values, setValues] = useState<FormState>(initial)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)

  const setField = (key: keyof FormState, v: string) =>
    setValues(prev => ({ ...prev, [key]: v }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaved(false)

    const payload = {
      ...values,
      geo_lat: Number(values.geo_lat),
      geo_lng: Number(values.geo_lng),
      radius_m: Number(values.radius_m),
    }

    // Same validators the API runs — fail fast with a friendly message.
    const clientError = validateWindows(payload) ?? validateGeo(payload)
    if (clientError) { setError(clientError); return }

    setSaving(true)
    try {
      const res = await fetch('/api/attendance/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? `Save failed (HTTP ${res.status})`)
      } else {
        setSaved(true)
        router.refresh()
        setTimeout(() => setSaved(false), 3000)
      }
    } catch {
      setError('Save failed — check your connection')
    } finally {
      setSaving(false)
    }
  }

  const timeInput = 'border rounded-lg px-2 py-1.5 text-sm w-full'
  const label = 'text-[11px] font-bold uppercase tracking-wide text-muted-foreground'

  return (
    <form onSubmit={submit} className="space-y-4">

      {/* Windows */}
      <div className="bg-white border rounded-xl p-4 space-y-4">
        <h2 className="text-sm font-bold text-tranmere-blue">Check-in windows (London time)</h2>

        {([
          ['am', 'Morning', <Sun key="i" size={14} className="text-blue-600" />],
          ['lunch', 'Lunch', <UtensilsCrossed key="i" size={14} className="text-green-600" />],
          ['pm', 'End of day', <Moon key="i" size={14} className="text-purple-600" />],
        ] as const).map(([phase, name, icon]) => (
          <div key={phase} className="grid grid-cols-[100px_1fr_1fr] gap-3 items-end">
            <span className="flex items-center gap-1.5 text-sm font-medium pb-1.5">{icon} {name}</span>
            <div>
              <label htmlFor={`${phase}-start`} className={label}>Opens</label>
              <input
                id={`${phase}-start`}
                type="time"
                required
                className={timeInput}
                value={values[`${phase}_window_start`]}
                onChange={e => setField(`${phase}_window_start`, e.target.value)}
              />
            </div>
            <div>
              <label htmlFor={`${phase}-end`} className={label}>Closes</label>
              <input
                id={`${phase}-end`}
                type="time"
                required
                className={timeInput}
                value={values[`${phase}_window_end`]}
                onChange={e => setField(`${phase}_window_end`, e.target.value)}
              />
            </div>
          </div>
        ))}
        <p className="text-[11px] text-muted-foreground">
          Windows must be in order and must not overlap: morning closes before lunch opens, lunch closes before end of day opens.
        </p>
      </div>

      {/* Geofence */}
      <div className="bg-white border rounded-xl p-4 space-y-3">
        <h2 className="flex items-center gap-1.5 text-sm font-bold text-tranmere-blue"><MapPin size={14} /> Geofence</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label htmlFor="geo-lat" className={label}>Latitude</label>
            <input id="geo-lat" type="number" step="any" required className={timeInput}
              value={values.geo_lat}
              onChange={e => setField('geo_lat', e.target.value)} />
          </div>
          <div>
            <label htmlFor="geo-lng" className={label}>Longitude</label>
            <input id="geo-lng" type="number" step="any" required className={timeInput}
              value={values.geo_lng}
              onChange={e => setField('geo_lng', e.target.value)} />
          </div>
          <div>
            <label htmlFor="radius-m" className={label}>Radius (metres)</label>
            <input id="radius-m" type="number" min={10} max={10000} step={1} required className={timeInput}
              value={values.radius_m}
              onChange={e => setField('radius_m', e.target.value)} />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Taps outside this radius are still recorded but flagged for review.
        </p>
      </div>

      {/* NFC token — admin only */}
      {nfcToken !== null && (
        <div className="bg-white border rounded-xl p-4 space-y-2">
          <h2 className="text-sm font-bold text-tranmere-blue">NFC sticker token</h2>
          <p className="text-[11px] text-muted-foreground">
            Encode this token in the URL written to new NFC stickers. Keep it private — anyone with the token can check in.
          </p>
          {revealed ? (
            <div className="flex items-center gap-2">
              <code className="text-xs bg-gray-100 border rounded-lg px-2.5 py-1.5 break-all select-all">{nfcToken}</code>
              <button type="button" onClick={() => setRevealed(false)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-tranmere-blue shrink-0">
                <EyeOff size={13} /> Hide
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setRevealed(true)}
              className="flex items-center gap-1.5 text-sm font-medium text-tranmere-blue bg-tranmere-blue/10 hover:bg-tranmere-blue/20 px-3 py-1.5 rounded-lg transition-colors">
              <Eye size={14} /> Click to reveal
            </button>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving}
          className="px-4 py-2 rounded-lg bg-tranmere-blue text-white text-sm font-semibold disabled:opacity-40 flex items-center gap-1.5 hover:bg-tranmere-blue/90">
          {saving && <Loader2 size={13} className="animate-spin" />}
          {saving ? 'Saving…' : 'Save settings'}
        </button>
        {saved && (
          <span className="flex items-center gap-1 text-sm text-green-700">
            <CheckCircle2 size={14} /> Saved
          </span>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>
      )}
    </form>
  )
}
