import { createClient } from '@/lib/supabase/server'
import { TrainingLogForm } from '@/components/training/TrainingLogForm'

const intensityColor = {
  low: 'text-green-600 bg-green-50',
  medium: 'text-yellow-700 bg-yellow-50',
  high: 'text-red-600 bg-red-50',
}

export default async function TrainingPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: sessions } = await supabase
    .from('training_logs')
    .select('*')
    .eq('student_id', user!.id)
    .order('session_date', { ascending: false })
    .limit(30)

  const totalSessions = sessions?.length ?? 0
  const totalMins = sessions?.reduce((s, t) => s + t.duration_mins, 0) ?? 0

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-tranmere-blue">Training</h1>

      {totalSessions > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl border p-3 text-center">
            <p className="text-2xl font-bold text-tranmere-blue">{totalSessions}</p>
            <p className="text-xs text-muted-foreground">Sessions</p>
          </div>
          <div className="bg-white rounded-xl border p-3 text-center">
            <p className="text-2xl font-bold text-tranmere-blue">{Math.round(totalMins / 60)}h</p>
            <p className="text-xs text-muted-foreground">Total time</p>
          </div>
        </div>
      )}

      <TrainingLogForm studentId={user!.id} />

      <div className="space-y-2">
        {sessions?.map(s => (
          <div key={s.id} className="bg-white rounded-xl border p-3 flex justify-between items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{s.session_type}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(s.session_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                {' · '}{s.duration_mins} mins
              </p>
              {s.notes && (
                <p className="text-xs text-muted-foreground mt-1 italic truncate">{s.notes}</p>
              )}
            </div>
            <span className={`text-xs font-semibold capitalize px-2 py-0.5 rounded-full shrink-0 ${intensityColor[s.intensity as keyof typeof intensityColor]}`}>
              {s.intensity}
            </span>
          </div>
        ))}
        {!sessions?.length && (
          <p className="text-sm text-muted-foreground text-center py-4">No sessions logged yet.</p>
        )}
      </div>
    </div>
  )
}
