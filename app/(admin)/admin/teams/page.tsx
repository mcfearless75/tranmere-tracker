import { createAdminClient } from '@/lib/supabase/admin'
import { TeamRosterCard, type Member } from './TeamRosterCard'
import { ManageTeams } from './ManageTeams'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import type { Team } from '@/lib/teams/types'

export const dynamic = 'force-dynamic'

/** A person who can be in a team: every active student, plus active staff. */
type Person = Omit<Member, 'team_ids'>

export default async function TeamsPage() {
  const supabase = createAdminClient()

  const [{ data: teams }, { data: retired }, { data: people }, { data: memberships }, { data: teamChats }] = await Promise.all([
    supabase.from('teams').select('id, name, sort_order, is_active')
      .eq('is_active', true).order('sort_order'),
    // Retired teams never show up in the query above (it's the same source
    // ManageTeams renders as "active"), so without this the only way back
    // from a retire is manual SQL — restore has to see what it's restoring.
    supabase.from('teams').select('id, name, sort_order, is_active')
      .eq('is_active', false).order('name'),
    // The AI Coach bot is a real public.users row (migration 012) — excluded
    // here alongside parents so it never appears as a person to place in a
    // team, which would make it squad-eligible (see ELIGIBLE_PLAYER_FILTER).
    supabase.from('users').select('id, name, role, year_group, team_id')
      .eq('is_active', true).neq('role', 'parent').neq('role', 'bot').order('name'),
    // Every team each person is in (089) — a player can be in several.
    supabase.from('team_members').select('team_id, user_id'),
    supabase.from('chat_rooms').select('id, sync_team_id').not('sync_team_id', 'is', null),
  ])

  const activeTeams = (teams ?? []) as Team[]
  const retiredTeams = (retired ?? []) as Team[]
  const activeTeamIds = new Set(activeTeams.map(t => t.id))
  const teamIdsByUser = new Map<string, string[]>()
  for (const tm of (memberships ?? []) as { team_id: string; user_id: string }[]) {
    const list = teamIdsByUser.get(tm.user_id) ?? []
    list.push(tm.team_id)
    teamIdsByUser.set(tm.user_id, list)
  }
  const members: Member[] = ((people ?? []) as Person[]).map(p => ({
    ...p,
    // Fall back to the main team if team_members is somehow missing a row.
    team_ids: teamIdsByUser.get(p.id) ?? (p.team_id ? [p.team_id] : []),
  }))
  const chatByTeam = new Map(
    ((teamChats ?? []) as { id: string; sync_team_id: string }[]).map(r => [r.sync_team_id, r.id])
  )

  // A player whose team has been retired counts as unassigned here, so they
  // resurface rather than disappearing into a team nobody can see.
  const unassigned = members.filter(m => !m.team_ids.some(id => activeTeamIds.has(id)))

  return (
    <div className="space-y-5">
      <Link href="/admin/home" className="inline-flex items-center gap-1 text-sm text-tranmere-blue hover:underline">
        <ArrowLeft size={14} /> Back
      </Link>
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-tranmere-blue">Teams</h1>
        <p className="text-sm text-muted-foreground mt-1">
          A player can be in more than one team. A match squad is picked from a team, and each team can have its own squad chat that follows the roster.
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
          roster={members.filter(m => m.team_ids.includes(team.id))}
          teams={activeTeams}
          candidates={members.filter(m => !m.team_ids.includes(team.id))}
          chatRoomId={chatByTeam.get(team.id) ?? null}
        />
      ))}

      <ManageTeams teams={activeTeams} retiredTeams={retiredTeams} />
    </div>
  )
}
