import { createClient } from '@/lib/supabase/server'
import { MatchLogForm } from '@/components/matches/MatchLogForm'
import { MatchInvitations } from './MatchInvitations'

export const dynamic = 'force-dynamic'

export default async function MatchesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: matches }, { data: invitations }] = await Promise.all([
    supabase
      .from('match_logs')
      .select('*')
      .eq('student_id', user!.id)
      .order('match_date', { ascending: false }),
    supabase
      .from('match_squads')
      .select(`
        id, status, coach_rating, position,
        match_events (id, match_date, opponent, location, status)
      `)
      .eq('player_id', user!.id)
      .order('created_at', { ascending: false }),
  ])

  const totalGoals = matches?.reduce((s, m) => s + m.goals, 0) ?? 0
  const totalAssists = matches?.reduce((s, m) => s + m.assists, 0) ?? 0
  const avgRating = matches?.length
    ? Math.round((matches.reduce((s, m) => s + (m.self_rating ?? 0), 0) / matches.length) * 10) / 10
    : null

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-tranmere-blue">Matches</h1>

      {invitations && invitations.length > 0 && (
        <MatchInvitations invitations={invitations as any} />
      )}

      {matches && matches.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {[
            ['Goals', totalGoals],
            ['Assists', totalAssists],
            ['Avg Rating', avgRating ?? '—'],
          ].map(([label, val]) => (
            <div key={label as string} className="bg-white rounded-xl border p-3 text-center">
              <p className="text-2xl font-bold text-tranmere-blue">{val}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      )}

      <MatchLogForm studentId={user!.id} />

      <div className="space-y-2">
        {matches?.map(m => (
          <div key={m.id} className="bg-white rounded-xl border p-3">
            <div className="flex justify-between items-start gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">vs {m.opponent}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(m.match_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {m.position && ` · ${m.position}`}
                  {` · ${m.minutes_played} mins`}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold">{m.goals}G {m.assists}A</p>
                {m.self_rating && (
                  <p className="text-xs text-muted-foreground">{m.self_rating}/10</p>
                )}
              </div>
            </div>
            {m.notes && (
              <p className="text-xs text-muted-foreground mt-1.5 italic border-t pt-1.5">{m.notes}</p>
            )}
          </div>
        ))}
        {!matches?.length && (
          <p className="text-sm text-muted-foreground text-center py-4">No matches logged yet.</p>
        )}
      </div>
    </div>
  )
}
