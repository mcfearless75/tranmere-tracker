import { createAdminClient } from '@/lib/supabase/admin'
import { TeamRosterCard } from './TeamRosterCard'
import { ManageTeams } from './ManageTeams'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import type { Team } from '@/lib/teams/types'

export const dynamic = 'force-dynamic'

/** A person who can be in a team: every active student, plus active staff. */
type Member = { id: string; name: string; role: string; year_group: number | null; team_id: string | null }

export default async function TeamsPage() {
  const supabase = createAdminClient()

  const [{ data: teams }, { data: people }] = await Promise.all([
    supabase.from('teams').select('id, name, sort_order, is_active')
      .eq('is_active', true).order('sort_order'),
    supabase.from('users').select('id, name, role, year_group, team_id')
      .eq('is_active', true).neq('role', 'parent').order('name'),
  ])

  const activeTeams = (teams ?? []) as Team[]
  const activeTeamIds = new Set(activeTeams.map(t => t.id))
  const members = (people ?? []) as Member[]

  // A player whose team has been retired counts as unassigned here, so they
  // resurface rather than disappearing into a team nobody can see.
  const unassigned = members.filter(m => !m.team_id || !activeTeamIds.has(m.team_id))

  return (
    <div className="space-y-5">
      <Link href="/admin/home" className="inline-flex items-center gap-1 text-sm text-tranmere-blue hover:underline">
        <ArrowLeft size={14} /> Back
      </Link>
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-tranmere-blue">Teams</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Move players between teams. A match squad is picked from a team.
        </p>
      </div>

      {unassigned.length > 0 && (
        <TeamRosterCard
          team={null}
          roster={unassigned}
          teams={activeTeams}
          candidates={[]}
        />
      )}

      {activeTeams.map(team => (
        <TeamRosterCard
          key={team.id}
          team={team}
          roster={members.filter(m => m.team_id === team.id)}
          teams={activeTeams}
          candidates={members.filter(m => m.team_id !== team.id)}
        />
      ))}

      <ManageTeams teams={activeTeams} />
    </div>
  )
}
