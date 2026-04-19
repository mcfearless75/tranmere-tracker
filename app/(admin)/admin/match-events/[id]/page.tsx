import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, LayoutGrid } from 'lucide-react'
import { MatchReport } from './MatchReport'

export const dynamic = 'force-dynamic'

export default async function MatchDetailPage({ params }: { params: { id: string } }) {
  const supabase = createAdminClient()

  const { data: match } = await supabase
    .from('match_events')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!match) notFound()

  const { data: squad } = await supabase
    .from('match_squads')
    .select('id, player_id, status, position, coach_rating, coach_notes, goals, assists, minutes_played, yellow_card, red_card, users:player_id(name, avatar_url)')
    .eq('match_id', params.id)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Link href="/admin/match-events" className="inline-flex items-center gap-1 text-sm text-tranmere-blue hover:underline">
          <ArrowLeft size={14} /> Match Squads
        </Link>
        <Link
          href={`/admin/formation?match=${match.id}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-tranmere-blue text-tranmere-blue px-3 py-1.5 text-sm font-semibold hover:bg-blue-50"
        >
          <LayoutGrid size={14} /> Open in Formation Builder
        </Link>
      </div>

      <MatchReport match={match} squad={(squad ?? []) as any} />
    </div>
  )
}
