import { createClient } from '@/lib/supabase/server'
import { MacroProgress } from '@/components/nutrition/MacroProgress'
import { NutritionClient } from './NutritionClient'
import { sumMacros } from '@/lib/utils'

export default async function NutritionPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const today = new Date().toISOString().split('T')[0]

  const [{ data: logs }, { data: goals }] = await Promise.all([
    supabase
      .from('nutrition_logs')
      .select('*')
      .eq('student_id', user!.id)
      .eq('logged_date', today)
      .order('created_at'),
    supabase
      .from('nutrition_goals')
      .select('*')
      .eq('student_id', user!.id)
      .maybeSingle(),
  ])

  const totals = sumMacros(logs ?? [])
  const targets = goals ?? { calories: 2500, protein_g: 150, carbs_g: 300, fat_g: 80 }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-tranmere-blue">Nutrition</h1>

      {/* Daily macro summary */}
      <div className="bg-white rounded-xl border p-4 space-y-3">
        <MacroProgress label="Calories" current={totals.calories} target={targets.calories} unit=" kcal" />
        <MacroProgress label="Protein" current={totals.protein_g} target={targets.protein_g} unit="g" />
        <MacroProgress label="Carbs" current={totals.carbs_g} target={targets.carbs_g} unit="g" />
        <MacroProgress label="Fat" current={totals.fat_g} target={targets.fat_g} unit="g" />
      </div>

      {/* Client section: log form + meal list (can refresh independently) */}
      <NutritionClient studentId={user!.id} logs={logs ?? []} />
    </div>
  )
}
