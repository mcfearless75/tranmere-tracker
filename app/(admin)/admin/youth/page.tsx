import { redirect } from 'next/navigation'
import { Users2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { SquadGrid } from '@/components/admin/youth/SquadGrid'
import { SquadForm } from '@/components/admin/youth/SquadForm'
import { CoachOption, SquadRow, SquadSummary } from '@/components/admin/youth/types'

export const dynamic = 'force-dynamic'

const STAFF_ROLES = ['admin', 'coach', 'teacher']

type FixtureRowLite = {
  squad_id: string
  opponent: string
  fixture_date: string
}

export default async function AdminYouthPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin-login')

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || !STAFF_ROLES.includes(profile.role)) redirect('/admin/dashboard')

  const today = new Date().toISOString().slice(0, 10)

  const [{ data: squadRows }, { data: playerRows }, { data: fixtureRows }, { data: staffRows }] =
    await Promise.all([
      admin.from('youth_squads').select('*').order('age_group').order('name'),
      admin.from('youth_players').select('squad_id'),
      admin
        .from('youth_fixtures')
        .select('squad_id, opponent, fixture_date')
        .gte('fixture_date', today)
        .order('fixture_date', { ascending: true }),
      admin.from('users').select('id, name').in('role', STAFF_ROLES).order('name'),
    ])

  const squads = (squadRows ?? []) as SquadRow[]
  const coaches = (staffRows ?? []) as CoachOption[]

  const playerCounts: Record<string, number> = {}
  for (const row of (playerRows ?? []) as { squad_id: string }[]) {
    playerCounts[row.squad_id] = (playerCounts[row.squad_id] ?? 0) + 1
  }

  const nextFixtures: Record<string, { opponent: string; fixture_date: string }> = {}
  for (const row of (fixtureRows ?? []) as FixtureRowLite[]) {
    if (!nextFixtures[row.squad_id]) {
      nextFixtures[row.squad_id] = { opponent: row.opponent, fixture_date: row.fixture_date }
    }
  }

  const coachNames: Record<string, string> = {}
  for (const coach of coaches) {
    coachNames[coach.id] = coach.name
  }

  const summaries: SquadSummary[] = squads.map(squad => ({
    ...squad,
    coachName: squad.coach_id ? coachNames[squad.coach_id] ?? null : null,
    playerCount: playerCounts[squad.id] ?? 0,
    nextFixture: nextFixtures[squad.id] ?? null,
  }))

  return (
    <div className="space-y-5 p-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-tranmere-blue">
          <Users2 size={20} /> Youth Football
        </h1>
        <p className="text-sm text-muted-foreground">
          Staff-managed youth squads — parents and guardians are the contact for all players
        </p>
      </div>

      <SquadGrid squads={summaries} />

      <SquadForm coaches={coaches} />
    </div>
  )
}
