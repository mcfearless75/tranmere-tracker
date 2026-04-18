import { createClient } from '@/lib/supabase/server'
import { TrainingLogForm } from '@/components/training/TrainingLogForm'

export const dynamic = 'force-dynamic'

const intensityColor = {
  low: 'text-green-600 bg-green-50',
  medium: 'text-yellow-700 bg-yellow-50',
  high: 'text-red-600 bg-red-50',
}

export default async function TrainingPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: sessions }, { data: gpsSessions }] = await Promise.all([
    supabase
      .from('training_logs')
      .select('*')
      .eq('student_id', user!.id)
      .order('session_date', { ascending: false })
      .limit(30),
    supabase
      .from('gps_sessions')
      .select('id, session_date, session_label, total_distance_m, max_speed_kmh, sprint_count, player_load, hr_avg, hr_max, duration_mins')
      .eq('player_id', user!.id)
      .order('session_date', { ascending: false })
      .limit(10),
  ])

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

      {/* STATSports GPS data */}
      {gpsSessions && gpsSessions.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <h2 className="font-semibold text-sm">GPS Data — STATSports</h2>
          </div>
          {gpsSessions.map(g => (
            <div key={g.id} className="bg-white rounded-xl border p-3 space-y-2">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-semibold">{g.session_label ?? 'Session'}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(g.session_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {g.duration_mins && ` · ${g.duration_mins} mins`}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {g.total_distance_m && (
                  <div className="bg-blue-50 rounded-lg p-2 text-center">
                    <p className="text-base font-bold text-tranmere-blue">{(g.total_distance_m / 1000).toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">km</p>
                  </div>
                )}
                {g.max_speed_kmh && (
                  <div className="bg-orange-50 rounded-lg p-2 text-center">
                    <p className="text-base font-bold text-orange-600">{g.max_speed_kmh}</p>
                    <p className="text-xs text-muted-foreground">km/h top</p>
                  </div>
                )}
                {g.sprint_count != null && (
                  <div className="bg-green-50 rounded-lg p-2 text-center">
                    <p className="text-base font-bold text-green-700">{g.sprint_count}</p>
                    <p className="text-xs text-muted-foreground">sprints</p>
                  </div>
                )}
                {g.hr_max && (
                  <div className="bg-red-50 rounded-lg p-2 text-center">
                    <p className="text-base font-bold text-red-600">{g.hr_max}</p>
                    <p className="text-xs text-muted-foreground">max HR</p>
                  </div>
                )}
                {g.hr_avg && (
                  <div className="bg-pink-50 rounded-lg p-2 text-center">
                    <p className="text-base font-bold text-pink-600">{g.hr_avg}</p>
                    <p className="text-xs text-muted-foreground">avg HR</p>
                  </div>
                )}
                {g.player_load && (
                  <div className="bg-purple-50 rounded-lg p-2 text-center">
                    <p className="text-base font-bold text-purple-700">{g.player_load}</p>
                    <p className="text-xs text-muted-foreground">player load</p>
                  </div>
                )}
              </div>
            </div>
          ))}
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
