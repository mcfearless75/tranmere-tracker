import { createClient } from '@/lib/supabase/server'
import { PlayerDashboard } from '@/components/gps/PlayerDashboard'
import { GpsRefreshButton } from '@/components/gps/GpsRefreshButton'

export const dynamic = 'force-dynamic'

export default async function StudentGpsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: profile }, { data: sessions }] = await Promise.all([
    supabase.from('users').select('name').eq('id', user!.id).single(),
    supabase
      .from('gps_sessions')
      .select('*')
      .eq('player_id', user!.id)
      .order('session_date', { ascending: false })
      .limit(30),
  ])

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-tranmere-blue">GPS Dashboard</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Performance data</p>
        </div>
        <GpsRefreshButton />
      </div>
      <PlayerDashboard sessions={sessions ?? []} playerName={profile?.name ?? 'Player'} />
    </div>
  )
}
