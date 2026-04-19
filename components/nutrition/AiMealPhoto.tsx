'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Sparkles, Camera, Check, X } from 'lucide-react'

type Estimate = {
  food_name: string
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  confidence: 'low' | 'medium' | 'high'
  notes?: string
}

export function AiMealPhoto({ studentId }: { studentId: string }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [estimate, setEstimate] = useState<Estimate | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File | null) {
    if (!file) return
    setError(null)
    setPreview(URL.createObjectURL(file))
    setBusy(true)

    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/ai/meal-photo', { method: 'POST', body: fd })
    const data = await res.json()
    setBusy(false)
    if (data.error) { setError(data.error); return }
    setEstimate(data.estimate)
  }

  async function confirmLog() {
    if (!estimate) return
    setBusy(true)
    const supabase = createClient()
    await supabase.from('nutrition_logs').insert({
      student_id: studentId,
      meal_type: estimate.meal_type,
      food_name: estimate.food_name,
      calories: Math.round(estimate.calories),
      protein_g: +(estimate.protein_g).toFixed(1),
      carbs_g: +(estimate.carbs_g).toFixed(1),
      fat_g: +(estimate.fat_g).toFixed(1),
    })
    setBusy(false)
    reset()
    router.refresh()
  }

  function reset() {
    setEstimate(null)
    setPreview(null)
    setError(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  if (estimate && preview) {
    return (
      <div className="rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50 via-white to-indigo-50 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-semibold flex items-center gap-1.5 text-purple-900">
            <Sparkles size={14} /> AI Estimate
          </p>
          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
            estimate.confidence === 'high' ? 'bg-green-100 text-green-700' :
            estimate.confidence === 'medium' ? 'bg-amber-100 text-amber-700' :
            'bg-red-100 text-red-700'
          }`}>
            {estimate.confidence} confidence
          </span>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={preview} alt="meal" className="w-full h-40 object-cover rounded-xl" />
        <p className="font-semibold text-sm">{estimate.food_name}</p>
        <p className="text-xs text-muted-foreground capitalize">{estimate.meal_type}</p>
        <div className="grid grid-cols-4 gap-2">
          <Macro label="kcal" value={estimate.calories} colour="bg-tranmere-blue" />
          <Macro label="P" value={`${estimate.protein_g}g`} colour="bg-red-500" />
          <Macro label="C" value={`${estimate.carbs_g}g`} colour="bg-amber-500" />
          <Macro label="F" value={`${estimate.fat_g}g`} colour="bg-green-500" />
        </div>
        {estimate.notes && <p className="text-xs italic text-muted-foreground">{estimate.notes}</p>}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={reset}
            className="flex items-center justify-center gap-1.5 rounded-xl border-2 border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold active:bg-gray-100"
          >
            <X size={14} /> Retake
          </button>
          <button
            onClick={confirmLog}
            disabled={busy}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white px-3 py-2.5 text-sm font-semibold shadow disabled:opacity-50"
          >
            <Check size={14} /> {busy ? 'Saving…' : 'Log it'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50 via-white to-indigo-50 p-4">
      <p className="font-semibold flex items-center gap-1.5 text-purple-900 mb-2">
        <Sparkles size={14} /> Log a meal from a photo
      </p>
      <p className="text-xs text-muted-foreground mb-3">
        Take a photo of your plate — Claude estimates calories &amp; macros automatically.
      </p>
      <button
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-3 text-sm font-semibold shadow disabled:opacity-50"
      >
        <Camera size={14} />
        {busy ? 'Analysing…' : 'Take Meal Photo'}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => handleFile(e.target.files?.[0] ?? null)}
      />
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  )
}

function Macro({ label, value, colour }: { label: string; value: number | string; colour: string }) {
  return (
    <div className="rounded-lg bg-white border p-2 text-center">
      <div className={`inline-block w-2 h-2 rounded-full ${colour} mb-0.5`} />
      <p className="text-xs font-bold">{value}</p>
      <p className="text-[10px] text-muted-foreground uppercase">{label}</p>
    </div>
  )
}
