import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { PlayerDashboard } from '@/components/gps/PlayerDashboard'

export const dynamic = 'force-dynamic'

export default async function AdminPlayerGpsPage({
  params,
}: {
  params: { playerId: string }
}) {
  const supabase = createAdminClient()
  const playerId = params.playerId

  const [{ data: profile }, { data: sessions }] = await Promise.all([
    supabase.from('users').select('id, name, role').eq('id', playerId).maybeSingle(),
    supabase
      .from('gps_sessions')
      .select('*')
      .eq('player_id', playerId)
      .order('session_date', { ascending: false })
      .limit(30),
  ])

  if (!profile) {
    return (
      <div className="space-y-3 py-10 text-center">
        <p className="font-semibold">Player not found.</p>
        <Link href="/admin/gps-dashboard" className="text-sm text-tranmere-blue underline">
          Back to squad GPS
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Link
        href="/admin/gps-dashboard"
        className="inline-flex items-center gap-1 text-sm text-tranmere-blue hover:underline"
      >
        <ArrowLeft size={14} /> Back to squad GPS
      </Link>
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-tranmere-blue">{profile.name}</h1>
        <p className="text-xs sm:text-sm text-muted-foreground">Same GPS view the player sees</p>
      </div>
      <PlayerDashboard sessions={sessions ?? []} playerName={profile.name ?? 'Player'} />
    </div>
  )
}
