import { createAdminClient } from '@/lib/supabase/admin'
import { FormationBuilder } from './FormationBuilder'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function FormationPage({ searchParams }: { searchParams: { match?: string } }) {
  const supabase = createAdminClient()

  const [{ data: students }, { data: matches }] = await Promise.all([
    supabase.from('users').select('id, name, avatar_url, year_group').eq('role', 'student').eq('is_active', true).order('name'),
    supabase.from('match_events').select('id, match_date, kick_off_time, opponent, status').order('match_date', { ascending: false }).limit(20),
  ])

  let matchSquad: { player_id: string; position: string | null }[] = []
  let existingSquadPlayerIds: string[] = []
  if (searchParams.match) {
    // Every status, not just accepted — this is how the builder tells an
    // already-invited player (position update only) apart from a brand-new
    // one being added here for the first time (needs a match_squads row
    // created AND a squad-invite push, same as CreateMatchForm sends).
    const { data } = await supabase
      .from('match_squads')
      .select('player_id, position, status')
      .eq('match_id', searchParams.match)
    matchSquad = (data ?? []).filter(r => r.status === 'accepted')
    existingSquadPlayerIds = (data ?? []).map(r => r.player_id)
  }

  return (
    <div className="space-y-5">
      <Link href="/admin/home" className="inline-flex items-center gap-1 text-sm text-tranmere-blue hover:underline">
        <ArrowLeft size={14} /> Back
      </Link>
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
        existingSquadPlayerIds={existingSquadPlayerIds}
      />
    </div>
  )
}
