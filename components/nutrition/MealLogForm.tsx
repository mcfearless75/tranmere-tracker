'use client'

import { useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { FoodSearchInput } from './FoodSearchInput'
import type { FoodItem } from '@/lib/openFoodFacts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const BarcodeScanner = dynamic(
  () => import('./BarcodeScanner').then(m => m.BarcodeScanner),
  { ssr: false }
)

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'
type Props = { studentId: string; onLogged: () => void }

export function MealLogForm({ studentId, onLogged }: Props) {
  const supabase = createClient()
  const [selected, setSelected] = useState<FoodItem | null>(null)
  const [grams, setGrams] = useState('100')
  const [meal, setMeal] = useState<MealType>('lunch')
  const [showScanner, setShowScanner] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleSelect = useCallback((item: FoodItem) => {
    setSelected(item)
    setGrams('100')
  }, [])

  function scaled(val: number) {
    const g = Math.max(1, Number(grams) || 100)
    return Math.round((val * g) / 100 * 10) / 10
  }

  async function handleSave() {
    if (!selected) return
    setSaving(true)
    await supabase.from('nutrition_logs').insert({
      student_id: studentId,
      logged_date: new Date().toISOString().split('T')[0],
      meal_type: meal,
      food_name: selected.food_name,
      barcode: selected.barcode,
      calories: scaled(selected.calories),
      protein_g: scaled(selected.protein_g),
      carbs_g: scaled(selected.carbs_g),
      fat_g: scaled(selected.fat_g),
    })
    setSelected(null)
    setGrams('100')
    setSaving(false)
    onLogged()
  }

  return (
    <div className="space-y-3 bg-white rounded-xl border p-4">
      <h2 className="font-semibold text-sm">Log Food</h2>

      <div className="flex gap-2">
        <div className="flex-1">
          <FoodSearchInput onSelect={handleSelect} />
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => setShowScanner(true)}
        >
          Scan
        </Button>
      </div>

      {showScanner && (
        <BarcodeScanner
          onResult={item => { handleSelect(item); setShowScanner(false) }}
          onClose={() => setShowScanner(false)}
        />
      )}

      {selected && (
        <div className="space-y-3 pt-1">
          <p className="text-sm font-medium">{selected.food_name}</p>
          <div className="flex gap-2 items-center">
            <Input
              type="number"
              value={grams}
              onChange={e => setGrams(e.target.value)}
              className="w-20 text-sm"
              min="1"
            />
            <span className="text-sm text-muted-foreground">g</span>
            <span className="text-xs text-muted-foreground ml-1">
              {scaled(selected.calories)} kcal · {scaled(selected.protein_g)}g protein
            </span>
          </div>
          <select
            value={meal}
            onChange={e => setMeal(e.target.value as MealType)}
            className="w-full text-sm border rounded-lg px-3 py-2 bg-white"
          >
            <option value="breakfast">Breakfast</option>
            <option value="lunch">Lunch</option>
            <option value="dinner">Dinner</option>
            <option value="snack">Snack</option>
          </select>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-tranmere-blue text-white py-3"
          >
            {saving ? 'Saving…' : 'Add to log'}
          </Button>
        </div>
      )}
    </div>
  )
}
