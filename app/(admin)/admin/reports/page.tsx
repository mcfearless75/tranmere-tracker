import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export default async function ReportsPage() {
  const supabase = createAdminClient()

  const { data: students } = await supabase
    .from('users')
    .select(`
      id, name, email,
      courses(name),
      submissions(status),
      training_logs(id),
      match_logs(goals, assists)
    `)
    .eq('role', 'student')
    .order('name')

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Student Reports</h1>
        <p className="text-sm text-muted-foreground">{students?.length ?? 0} students</p>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Student', 'Course', 'Assignments', 'Submitted', 'Training', 'Goals', 'Assists'].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students?.map(s => {
                const subs = (s.submissions as any[]) ?? []
                const total = subs.length
                const submitted = subs.filter(x => ['submitted', 'graded'].includes(x.status)).length
                const trainingSessions = (s.training_logs as any[])?.length ?? 0
                const goals = (s.match_logs as any[])?.reduce((acc: number, m: any) => acc + (m.goals ?? 0), 0) ?? 0
                const assists = (s.match_logs as any[])?.reduce((acc: number, m: any) => acc + (m.assists ?? 0), 0) ?? 0
                const allSubmitted = total > 0 && submitted === total

                return (
                  <tr key={s.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{s.name}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs max-w-[160px] truncate">
                      {(s.courses as any)?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-center">{total}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={allSubmitted ? 'text-green-700 font-semibold' : total === 0 ? 'text-muted-foreground' : ''}>
                        {submitted}/{total}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">{trainingSessions}</td>
                    <td className="px-4 py-3 text-center">{goals}</td>
                    <td className="px-4 py-3 text-center">{assists}</td>
                  </tr>
                )
              })}
              {!students?.length && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    No students yet. Invite students using the Users page.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
