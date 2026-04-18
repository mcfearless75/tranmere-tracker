import { createAdminClient } from '@/lib/supabase/admin'
import { StudentMatchForm } from './StudentMatchForm'

export const dynamic = 'force-dynamic'

export default async function StudentMatchesPage() {
  const supabase = createAdminClient()
  const { data: students } = await supabase
    .from('users')
    .select('id, name, courses(name)')
    .eq('role', 'student')
    .order('name')

  const { data: recentMatches } = await supabase
    .from('match_logs')
    .select('id, match_date, opponent, goals, assists, rating, student_id, users(name)')
    .order('match_date', { ascending: false })
    .limit(20)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Match Entry</h1>
      <p className="text-sm text-muted-foreground">Log match stats on behalf of students</p>
      <StudentMatchForm students={(students ?? []) as any} />
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-4 py-3 border-b font-semibold text-sm">Recent Entries</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[500px]">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Student', 'Date', 'Opponent', 'Goals', 'Assists', 'Rating'].map(h => (
                  <th key={h} className="text-left px-4 py-2 font-semibold text-muted-foreground text-xs">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentMatches?.map(m => (
                <tr key={m.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium">{(m.users as any)?.name}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{new Date(m.match_date).toLocaleDateString('en-GB')}</td>
                  <td className="px-4 py-2 text-xs">{m.opponent}</td>
                  <td className="px-4 py-2">{m.goals}</td>
                  <td className="px-4 py-2">{m.assists}</td>
                  <td className="px-4 py-2">{m.rating}/10</td>
                </tr>
              ))}
              {!recentMatches?.length && (
                <tr><td colSpan={6} className="px-4 py-4 text-center text-muted-foreground text-xs">No matches yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
