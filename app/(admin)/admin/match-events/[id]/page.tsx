import { createAdminClient } from '@/lib/supabase/admin'
import { eligiblePlayers } from '@/lib/teams/players'
import type { TeamRef } from '@/lib/teams/types'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, LayoutGrid } from 'lucide-react'
import { MatchReport } from './MatchReport'
import { MatchEditForm } from './MatchEditForm'
import { AddPlayersLater } from './AddPlayersLater'

export const dynamic = 'force-dynamic'

/**
 * The pickable-player shape eligiblePlayers() now returns here. This is also
 * the bug fix: the old query (`role = 'student'`, no `is_active` filter) let
 * deactivated students keep appearing in "Add players later" — its two
 * sibling queries on this page already filtered is_active correctly.
 */
type EligiblePlayer = {
  id: string
  name: string
  year_group: number | null
  role: string
  team_id: string | null
  teams: TeamRef | null
}

export default async function MatchDetailPage({ params }: { params: { id: string } }) {
  const supabase = createAdminClient()

  const { data: match } = await supabase
    .from('match_events')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!match) notFound()

  const [{ data: squad }, { data: students }] = await Promise.all([
    supabase
      .from('match_squads')
      .select('id, player_id, status, position, coach_rating, coach_notes, goals, assists, minutes_played, yellow_card, red_card, users:player_id(name, avatar_url, year_group)')
      .eq('match_id', params.id),
    eligiblePlayers(supabase, 'id, name, year_group, role, team_id, teams(id, name)'),
  ])

  const inSquad = new Set((squad ?? []).map((s: { player_id: string }) => s.player_id))
  const available = ((students ?? []) as unknown as EligiblePlayer[]).filter(s => !inSquad.has(s.id))

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

      <MatchEditForm match={match} />
      <AddPlayersLater matchId={match.id} opponent={match.opponent} available={available} />
      <MatchReport match={match} squad={(squad ?? []) as any} />
    </div>
  )
}
