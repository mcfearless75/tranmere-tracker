'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Camera, Sparkles, Check, X, Loader2 } from 'lucide-react'
import { validateImageFile, compressImage } from './mealPhoto'

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

type Estimate = {
  food_name: string
  meal_type: MealType
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  confidence: 'low' | 'medium' | 'high'
  notes?: string
}

type Props = { studentId: string }

export function MealPhotoUpload({ studentId }: Props) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [estimate, setEstimate] = useState<Estimate | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File | null) {
    if (!file) return
    setError(null)
    setEstimate(null)

    const valid = validateImageFile(file)
    if (!valid.ok) {
      setError(valid.error)
      if (fileRef.current) fileRef.current.value = ''
      return
    }

    setPreview(URL.createObjectURL(file))
    setBusy(true)

    try {
      const upload = await compressImage(file)
      const fd = new FormData()
      fd.append('file', upload)
      const res = await fetch('/api/ai/meal-photo', { method: 'POST', body: fd })
      const data: { error?: string; estimate?: Estimate } = await res.json()
      if (data.error || !data.estimate) {
        setError(data.error ?? 'Could not analyse photo. Please try again.')
        return
      }
      setEstimate(data.estimate)
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  async function handleLog() {
    if (!estimate) return
    setBusy(true)
    try {
      const supabase = createClient()
      const { error: dbErr } = await supabase.from('nutrition_logs').insert({
        student_id: studentId,
        logged_date: new Date().toISOString().split('T')[0],
        meal_type: estimate.meal_type,
        food_name: estimate.food_name,
        calories: Math.round(estimate.calories),
        protein_g: +estimate.protein_g.toFixed(1),
        carbs_g: +estimate.carbs_g.toFixed(1),
        fat_g: +estimate.fat_g.toFixed(1),
      })
      if (dbErr) { setError('Failed to save meal. Please try again.'); return }
      reset()
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  function reset() {
    setEstimate(null)
    setPreview(null)
    setError(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  // Result card
  if (estimate && preview) {
    return (
      <div className="rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50 via-white to-indigo-50 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-semibold flex items-center gap-1.5 text-purple-900 text-sm">
            <Sparkles size={14} /> AI Estimate
          </p>
          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
            estimate.confidence === 'high'
              ? 'bg-green-100 text-green-700'
              : estimate.confidence === 'medium'
              ? 'bg-amber-100 text-amber-700'
              : 'bg-red-100 text-red-700'
          }`}>
            {estimate.confidence} confidence
          </span>
        </div>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={preview} alt="meal photo" className="w-full h-40 object-cover rounded-xl" />

        <div>
          <p className="font-semibold text-sm">{estimate.food_name}</p>
          <p className="text-xs text-muted-foreground capitalize">{estimate.meal_type}</p>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <MacroChip label="kcal" value={String(estimate.calories)} colour="bg-tranmere-blue" />
          <MacroChip label="P" value={`${estimate.protein_g}g`} colour="bg-red-500" />
          <MacroChip label="C" value={`${estimate.carbs_g}g`} colour="bg-amber-500" />
          <MacroChip label="F" value={`${estimate.fat_g}g`} colour="bg-green-500" />
        </div>

        {estimate.notes && (
          <p className="text-xs italic text-muted-foreground">{estimate.notes}</p>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={reset}
            className="flex items-center justify-center gap-1.5 rounded-xl border-2 border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold active:bg-gray-50"
          >
            <X size={14} /> Retake
          </button>
          <button
            onClick={handleLog}
            disabled={busy}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white px-3 py-2.5 text-sm font-semibold shadow disabled:opacity-50"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {busy ? 'Saving…' : 'Log this meal'}
          </button>
        </div>
      </div>
    )
  }

  // Upload / capture card
  return (
    <div className="rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50 via-white to-indigo-50 p-4">
      <p className="font-semibold flex items-center gap-1.5 text-purple-900 text-sm mb-1">
        <Sparkles size={14} /> Log meal with photo
      </p>
      <p className="text-xs text-muted-foreground mb-3">
        Tap to take a photo or upload — Claude estimates calories &amp; macros automatically.
      </p>

      <button
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-3 text-sm font-semibold shadow disabled:opacity-60"
      >
        {busy ? (
          <><Loader2 size={16} className="animate-spin" /> Analysing…</>
        ) : (
          <><Camera size={16} /> Take a photo or upload</>
        )}
      </button>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => handleFile(e.target.files?.[0] ?? null)}
      />

      {error && (
        <p className="text-xs text-red-600 mt-2">{error}</p>
      )}
    </div>
  )
}

function MacroChip({ label, value, colour }: { label: string; value: string; colour: string }) {
  return (
    <div className="rounded-lg bg-white border p-2 text-center">
      <div className={`inline-block w-2 h-2 rounded-full ${colour} mb-0.5`} />
      <p className="text-xs font-bold">{value}</p>
      <p className="text-[10px] text-muted-foreground uppercase">{label}</p>
    </div>
  )
}
