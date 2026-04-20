'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Search, Zap, Check } from 'lucide-react'
import { UK_FOODS, QUICK_PICKS, searchFoods, type UkFood } from '@/lib/foods/uk-foods'

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

function guessMealType(): MealType {
  const h = new Date().getHours()
  if (h < 11) return 'breakfast'
  if (h < 15) return 'lunch'
  if (h < 21) return 'dinner'
  return 'snack'
}

export function UkFoodSearch({ studentId }: { studentId: string }) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [mealType, setMealType] = useState<MealType>(guessMealType())
  const [saving, setSaving] = useState<string | null>(null)
  const [justAdded, setJustAdded] = useState<string | null>(null)

  const results = useMemo(() => q.trim() ? searchFoods(q, 40) : [], [q])
  const showing = q.trim() ? results : QUICK_PICKS

  async function log(food: UkFood) {
    setSaving(food.name)
    const supabase = createClient()
    await supabase.from('nutrition_logs').insert({
      student_id: studentId,
      meal_type: mealType,
      food_name: `${food.name} (${food.serving})`,
      calories: Math.round(food.calories),
      protein_g: +food.protein_g.toFixed(1),
      carbs_g: +food.carbs_g.toFixed(1),
      fat_g: +food.fat_g.toFixed(1),
    })
    setSaving(null)
    setJustAdded(food.name)
    setTimeout(() => setJustAdded(null), 1500)
    router.refresh()
  }

  return (
    <div className="rounded-2xl border bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-semibold flex items-center gap-1.5 text-tranmere-blue">
          <Zap size={14} /> UK Food Quick Log
        </p>
        <select
          value={mealType}
          onChange={e => setMealType(e.target.value as MealType)}
          className="text-xs border rounded-lg px-2 py-1 bg-white capitalize"
        >
          <option value="breakfast">Breakfast</option>
          <option value="lunch">Lunch</option>
          <option value="dinner">Dinner</option>
          <option value="snack">Snack</option>
        </select>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search 'spag bol', 'greggs', 'chippy chips'…"
          className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-tranmere-blue outline-none"
        />
      </div>

      {!q.trim() && (
        <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">
          Quick picks — athlete favourites
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-96 overflow-y-auto pr-1">
        {showing.map(f => {
          const isAdded = justAdded === f.name
          return (
            <button
              key={f.name}
              onClick={() => log(f)}
              disabled={saving === f.name || isAdded}
              className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-all active:scale-95 ${
                isAdded
                  ? 'border-green-400 bg-green-50'
                  : 'border-gray-200 hover:border-tranmere-blue hover:bg-blue-50'
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{f.name}</p>
                <p className="text-xs text-muted-foreground">
                  {f.serving} · <span className="font-medium text-tranmere-blue">{f.calories} kcal</span>
                  <span className="ml-1.5">P {f.protein_g}g · C {f.carbs_g}g · F {f.fat_g}g</span>
                </p>
              </div>
              {isAdded ? (
                <Check size={16} className="text-green-600 shrink-0" />
              ) : (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-600 shrink-0">
                  + Log
                </span>
              )}
            </button>
          )
        })}
        {q.trim() && results.length === 0 && (
          <p className="col-span-full text-xs text-muted-foreground text-center py-6">
            No match in UK database. Try the barcode scanner or AI meal photo above ☝️
          </p>
        )}
      </div>

      <p className="text-[10px] text-muted-foreground text-center">
        {UK_FOODS.length} UK foods bundled offline · aligned to CoFID (Public Health England)
      </p>
    </div>
  )
}
