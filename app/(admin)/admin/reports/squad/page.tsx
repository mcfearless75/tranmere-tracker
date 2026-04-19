import { createAdminClient } from '@/lib/supabase/admin'
import { SquadReportClient } from './SquadReportClient'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function SquadReportPage() {
  const supabase = createAdminClient()

  const [{ data: students }, { data: gps }, { data: matches }] = await Promise.all([
    supabase.from('users').select('id, name, avatar_url').eq('role', 'student').order('name'),
    supabase.from('gps_sessions').select('player_id, session_date, session_label, total_distance_m, max_speed_kmh, sprint_count, player_load').order('session_date', { ascending: false }).limit(500),
    supabase.from('match_logs').select('student_id, match_date, opponent, goals, assists, self_rating, minutes_played').order('match_date', { ascending: false }).limit(500),
  ])

  return (
    <div className="space-y-5">
      <Link href="/admin/reports" className="inline-flex items-center gap-1 text-sm text-tranmere-blue hover:underline">
        <ArrowLeft size={14} /> Reports
      </Link>
      <div>
        <h1 className="text-2xl font-bold text-tranmere-blue">Squad Performance</h1>
        <p className="text-sm text-muted-foreground mt-1">GPS & match analytics with team baselines</p>
      </div>
      <SquadReportClient students={students ?? []} gps={gps ?? []} matches={matches ?? []} />
    </div>
  )
}
