import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { CreateMatchForm } from './CreateMatchForm'
import { MatchEventList } from './MatchEventList'
import Link from 'next/link'
import { LayoutGrid } from 'lucide-react'

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
      <CreateMatchForm students={students ?? []} coachId={user!.id} />
      <MatchEventList matches={(matches ?? []) as any} />
    </div>
  )
}
