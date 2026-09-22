import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { eligiblePlayers } from '@/lib/teams/players'
import type { Team, TeamRef } from '@/lib/teams/types'
import { CreateMatchForm } from './CreateMatchForm'
import { MatchEventList } from './MatchEventList'
import Link from 'next/link'
import { LayoutGrid } from 'lucide-react'

export const dynamic = 'force-dynamic'

/**
 * The pickable-player shape this page's queries now return. `role` and
 * `team_id` aren't rendered here (CreateMatchForm only shows name/year), but
 * they come back from eligiblePlayers()'s select and carrying them keeps this
 * type an honest description of the query, not a hand-trimmed subset of it.
 */
type EligiblePlayer = {
  id: string
  name: string
  // Nullable in the DB but always populated in practice (DEFAULT 1) — kept
  // non-null here to match CreateMatchForm's existing Student type, which
  // this task does not touch.
  year_group: number
  role: string
  team_id: string | null
  teams: TeamRef | null
}

export default async function MatchEventsPage() {
  const auth = createClient()
  const { data: { user } } = await auth.auth.getUser()
  const supabase = createAdminClient()

  const [{ data: students }, { data: matches }, { data: teams }] = await Promise.all([
    eligiblePlayers(supabase, 'id, name, year_group, role, team_id, teams(id, name)'),
    supabase
      .from('match_events')
      .select(`
        id, match_date, kick_off_time, opponent, location, status, notes,
        match_squads (
          id, player_id, status, coach_rating, position,
          users:player_id (name)
        )
      `)
      .order('match_date', { ascending: false }),
    supabase.from('teams').select('id, name, sort_order, is_active')
      .eq('is_active', true).order('sort_order'),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-tranmere-blue">Match Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Create matches and assign players to squads</p>
        </div>
        <Link
          href="/admin/formation"
          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white px-4 py-2 text-sm font-semibold shadow-lg hover:shadow-xl transition"
        >
          <LayoutGrid size={16} /> Open Formation Pitch
        </Link>
      </div>
      <CreateMatchForm
        students={(students ?? []) as unknown as EligiblePlayer[]}
        teams={(teams ?? []) as Team[]}
        coachId={user!.id}
      />
      <MatchEventList matches={(matches ?? []) as any} />
    </div>
  )
}
