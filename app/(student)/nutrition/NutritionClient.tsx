'use client'

import { useRouter } from 'next/navigation'
import { MealLogForm } from '@/components/nutrition/MealLogForm'

type Log = {
  id: string
  meal_type: string
  food_name: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

type Props = { studentId: string; logs: Log[] }

const MEAL_ORDER: Log['meal_type'][] = ['breakfast', 'lunch', 'dinner', 'snack']

export function NutritionClient({ studentId, logs: initialLogs }: Props) {
  const router = useRouter()
  const logs = initialLogs

  function handleLogged() {
    router.refresh()
  }

  const byMeal = (meal: string) => logs.filter(l => l.meal_type === meal)

  return (
    <div className="space-y-4">
      <MealLogForm studentId={studentId} onLogged={handleLogged} />

      {MEAL_ORDER.map(meal => {
        const items = byMeal(meal)
        if (!items.length) return null
        return (
          <div key={meal} className="bg-white rounded-xl border p-3">
            <h3 className="text-sm font-semibold capitalize mb-2">{meal}</h3>
            <div className="space-y-1">
              {items.map(item => (
                <div key={item.id} className="flex justify-between items-center text-xs py-1.5 border-b last:border-0">
                  <span className="truncate pr-2 flex-1">{item.food_name}</span>
                  <div className="shrink-0 text-right">
                    <span className="font-medium">{item.calories} kcal</span>
                    <span className="text-muted-foreground ml-2">{Number(item.protein_g).toFixed(1)}g P</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
