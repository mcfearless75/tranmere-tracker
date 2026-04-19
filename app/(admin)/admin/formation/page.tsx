import { createAdminClient } from '@/lib/supabase/admin'
import { FormationBuilder } from './FormationBuilder'

export const dynamic = 'force-dynamic'

export default async function FormationPage({ searchParams }: { searchParams: { match?: string } }) {
  const supabase = createAdminClient()

  const [{ data: students }, { data: matches }] = await Promise.all([
    supabase.from('users').select('id, name, avatar_url').eq('role', 'student').order('name'),
    supabase.from('match_events').select('id, match_date, opponent, status').order('match_date', { ascending: false }).limit(20),
  ])

  let matchSquad: { player_id: string; position: string | null }[] = []
  if (searchParams.match) {
    const { data } = await supabase
      .from('match_squads')
      .select('player_id, position')
      .eq('match_id', searchParams.match)
      .eq('status', 'accepted')
    matchSquad = data ?? []
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-tranmere-blue">Formation Builder</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pick a formation, tap a position, then tap a player to place them.
        </p>
      </div>
      <FormationBuilder
        students={students ?? []}
        matches={matches ?? []}
        selectedMatchId={searchParams.match ?? null}
        initialSquad={matchSquad}
      />
    </div>
  )
}
