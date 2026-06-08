import { createClient } from '@/lib/supabase/server'
import { getPersonalBests, formatLift } from '@/lib/gym/gymUtils'
import { GymPageClient } from './GymPageClient'

export default async function GymPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const since = new Date()
  since.setDate(since.getDate() - 30)
  const sinceDate = since.toISOString().split('T')[0]

  const { data: logs } = await supabase
    .from('gym_logs')
    .select('*')
    .eq('student_id', user!.id)
    .gte('logged_date', sinceDate)
    .order('logged_at', { ascending: false })

  const allLogs = logs ?? []
  const pbs = getPersonalBests(allLogs)
  const pbEntries = Object.entries(pbs).sort((a, b) => a[0].localeCompare(b[0]))

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-tranmere-blue">Gym & Strength</h1>

      {/* Personal Bests */}
      {pbEntries.length > 0 && (
        <div className="rounded-2xl bg-white border border-gray-200 p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-700 mb-3">Personal Bests</h2>
          <div className="grid grid-cols-2 gap-2">
            {pbEntries.map(([exercise, maxKg]) => (
              <div key={exercise} className="rounded-xl bg-tranmere-blue/5 border border-tranmere-blue/20 px-3 py-2.5">
                <p className="text-xs text-gray-500 truncate">{exercise}</p>
                <p className="text-lg font-bold text-tranmere-blue">{maxKg}kg</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent logs */}
      {allLogs.length > 0 && (
        <div className="rounded-2xl bg-white border border-gray-200 p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-700 mb-3">Recent Lifts</h2>
          <ul className="divide-y divide-gray-100">
            {allLogs.slice(0, 20).map((log) => {
              const summary = formatLift({
                exercise: log.exercise,
                weight_kg: log.weight_kg,
                sets: log.sets,
                reps: log.reps,
                logged_date: log.logged_date,
              })
              return (
                <li key={log.id} className="py-2.5 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{log.exercise}</p>
                    {summary && <p className="text-xs text-gray-500">{summary}</p>}
                    {log.notes && <p className="text-xs text-gray-400 italic mt-0.5">{log.notes}</p>}
                  </div>
                  <p className="text-xs text-gray-400 whitespace-nowrap shrink-0">{log.logged_date}</p>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* Log form — client island */}
      <GymPageClient />
    </div>
  )
}
