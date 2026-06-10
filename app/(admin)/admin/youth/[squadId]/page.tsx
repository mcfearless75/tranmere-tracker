import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { SquadTabs } from '@/components/admin/youth/SquadTabs'
import { SquadRow, YouthFixtureRow, YouthPlayerRow } from '@/components/admin/youth/types'

export const dynamic = 'force-dynamic'

const STAFF_ROLES = ['admin', 'coach', 'teacher']

export default async function AdminYouthSquadPage({
  params,
}: {
  params: { squadId: string }
}) {
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

  const { data: squadRow } = await admin
    .from('youth_squads')
    .select('*')
    .eq('id', params.squadId)
    .maybeSingle()

  if (!squadRow) redirect('/admin/youth')

  const squad = squadRow as SquadRow

  const [{ data: playerRows }, { data: fixtureRows }, { data: coachRow }] = await Promise.all([
    admin
      .from('youth_players')
      .select('*')
      .eq('squad_id', squad.id)
      .order('last_name')
      .order('first_name'),
    admin
      .from('youth_fixtures')
      .select('*')
      .eq('squad_id', squad.id)
      .order('fixture_date', { ascending: false }),
    squad.coach_id
      ? admin.from('users').select('name').eq('id', squad.coach_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const players = (playerRows ?? []) as YouthPlayerRow[]
  const fixtures = (fixtureRows ?? []) as YouthFixtureRow[]
  const coachName = (coachRow as { name: string } | null)?.name ?? null

  return (
    <div className="space-y-5 p-4">
      <div>
        <Link
          href="/admin/youth"
          className="inline-flex items-center gap-1 text-xs font-semibold text-tranmere-blue"
        >
          <ChevronLeft size={14} /> All squads
        </Link>
        <div className="mt-1 flex items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold text-tranmere-blue">{squad.name}</h1>
            <p className="text-sm text-muted-foreground">
              {squad.age_group} · Coach: {coachName ?? 'Unassigned'}
            </p>
          </div>
        </div>
        {squad.notes && <p className="mt-2 text-xs text-gray-700">{squad.notes}</p>}
      </div>

      <SquadTabs squadId={squad.id} players={players} fixtures={fixtures} />
    </div>
  )
}
