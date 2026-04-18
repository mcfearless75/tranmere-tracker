import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { CreateMatchForm } from './CreateMatchForm'
import { MatchEventList } from './MatchEventList'

export const dynamic = 'force-dynamic'

export default async function MatchEventsPage() {
  const auth = createClient()
  const { data: { user } } = await auth.auth.getUser()
  const supabase = createAdminClient()

  const [{ data: students }, { data: matches }] = await Promise.all([
    supabase
      .from('users')
      .select('id, name')
      .eq('role', 'student')
      .order('name'),
    supabase
      .from('match_events')
      .select(`
        id, match_date, opponent, location, status, notes,
        match_squads (
          id, player_id, status, coach_rating, position,
          users:player_id (name)
        )
      `)
      .order('match_date', { ascending: false }),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-tranmere-blue">Match Management</h1>
        <p className="text-sm text-muted-foreground mt-1">Create matches and assign players to squads</p>
      </div>
      <CreateMatchForm students={students ?? []} coachId={user!.id} />
      <MatchEventList matches={(matches ?? []) as any} />
    </div>
  )
}
