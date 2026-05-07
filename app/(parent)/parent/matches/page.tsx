import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

interface MatchSquadRow {
  id: string
  status: string | null
  coach_rating: number | null
  position: string | null
  match_events: {
    id: string
    match_date: string
    opponent: string
    location: string
    status: string | null
  } | null
}

function SquadBadge({ status }: { status: string | null }) {
  const s = status ?? 'unknown'
  const styles: Record<string, string> = {
    playing: 'bg-green-100 text-green-700',
    bench: 'bg-amber-100 text-amber-700',
    squad: 'bg-blue-100 text-blue-700',
    unavailable: 'bg-gray-100 text-gray-400',
  }
  return (
    <span className={`px-2 py-0.5 text-xs rounded-full font-medium capitalize ${styles[s] ?? 'bg-gray-100 text-gray-500'}`}>
      {s}
    </span>
  )
}

function StarRating({ rating }: { rating: number | null }) {
  if (rating === null) return null
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} className={`text-sm ${i <= rating ? 'text-tranmere-gold' : 'text-gray-200'}`}>★</span>
      ))}
    </div>
  )
}

export default async function ParentMatchesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: links } = await admin
    .from('parent_student_links')
    .select('student_id')
    .eq('parent_id', user.id)

  const studentIds = (links ?? []).map(l => l.student_id as string)

  if (studentIds.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">No students linked to your account.</p>
      </div>
    )
  }

  const today = new Date().toISOString().split('T')[0]
  const ago60 = new Date(Date.now() - 60 * 86400000).toISOString().split('T')[0]

  const studentsMatches = await Promise.all(studentIds.map(async (sid) => {
    const [{ data: profile }, { data: squads }] = await Promise.all([
      admin.from('users').select('name').eq('id', sid).single(),
      admin.from('match_squads')
        .select('id, status, coach_rating, position, match_events(id, match_date, opponent, location, status)')
        .eq('player_id', sid)
        .not('match_events', 'is', null)
        .order('created_at', { ascending: false })
        .limit(30),
    ])

    const rows = (squads ?? []) as unknown as MatchSquadRow[]
    const upcoming = rows.filter(r => r.match_events && r.match_events.match_date >= today)
      .sort((a, b) => (a.match_events!.match_date > b.match_events!.match_date ? 1 : -1))
    const past = rows.filter(r => r.match_events && r.match_events.match_date < today && r.match_events.match_date >= ago60)
      .sort((a, b) => (a.match_events!.match_date > b.match_events!.match_date ? -1 : 1))

    return { sid, name: (profile as { name: string } | null)?.name ?? 'Student', upcoming, past }
  }))

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-tranmere-blue">Matches</h1>

      {studentsMatches.map(({ sid, name, upcoming, past }) => (
        <div key={sid} className="space-y-4">
          <p className="font-semibold text-gray-700">{name}</p>

          {/* Upcoming */}
          <div className="bg-white border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Upcoming Fixtures</p>
            </div>
            {upcoming.length > 0 ? (
              <ul className="divide-y">
                {upcoming.map(row => (
                  <li key={row.id} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-gray-800">vs {row.match_events!.opponent}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(row.match_events!.match_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                        {row.match_events!.location ? ` · ${row.match_events!.location}` : ''}
                      </p>
                    </div>
                    <SquadBadge status={row.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-3 text-sm text-gray-400">No upcoming fixtures.</p>
            )}
          </div>

          {/* Past */}
          <div className="bg-white border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Recent Matches (last 60 days)</p>
            </div>
            {past.length > 0 ? (
              <ul className="divide-y">
                {past.map(row => (
                  <li key={row.id} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-gray-800">vs {row.match_events!.opponent}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(row.match_events!.match_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                        {row.match_events!.location ? ` · ${row.match_events!.location}` : ''}
                      </p>
                      {row.coach_rating !== null && <StarRating rating={row.coach_rating} />}
                    </div>
                    <SquadBadge status={row.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-3 text-sm text-gray-400">No recent matches.</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
