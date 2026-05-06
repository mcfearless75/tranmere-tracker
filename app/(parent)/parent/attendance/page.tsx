import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

interface AttendanceRecord {
  attendance_date: string
  am_checked_at: string | null
  pm_checked_at: string | null
  session_label: string
  session_type: string
}

function AttendanceBadge({ checked }: { checked: boolean }) {
  return (
    <span className={`inline-block w-2.5 h-2.5 rounded-full ${checked ? 'bg-green-500' : 'bg-gray-200'}`} />
  )
}

export default async function ParentAttendancePage() {
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

  const ago60 = new Date(Date.now() - 60 * 86400000).toISOString().split('T')[0]
  const today = new Date().toISOString().split('T')[0]

  const studentsAttendance = await Promise.all(studentIds.map(async (sid) => {
    const [{ data: profile }, { data: sessions }, { data: attendance }] = await Promise.all([
      admin.from('users').select('name').eq('id', sid).single(),
      admin.from('attendance_sessions').select('id, session_label, session_type, scheduled_date').gte('scheduled_date', ago60).lte('scheduled_date', today).order('scheduled_date', { ascending: false }),
      admin.from('daily_attendance').select('attendance_date, am_checked_at, pm_checked_at').eq('student_id', sid).gte('attendance_date', ago60).lte('attendance_date', today),
    ])

    const attendanceMap = new Map<string, { am: string | null; pm: string | null }>()
    for (const row of attendance ?? []) {
      attendanceMap.set(row.attendance_date as string, { am: row.am_checked_at as string | null, pm: row.pm_checked_at as string | null })
    }

    const scheduledDates = new Set((sessions ?? []).map(s => s.scheduled_date as string))
    const presentDates = new Set([...attendanceMap.keys()].filter(d => scheduledDates.has(d)))
    const pct = scheduledDates.size > 0 ? Math.round(presentDates.size / scheduledDates.size * 100) : null

    const records: AttendanceRecord[] = (sessions ?? []).map(s => {
      const att = attendanceMap.get(s.scheduled_date as string)
      return {
        attendance_date: s.scheduled_date as string,
        am_checked_at: att?.am ?? null,
        pm_checked_at: att?.pm ?? null,
        session_label: s.session_label as string,
        session_type: s.session_type as string,
      }
    })

    return { sid, name: (profile as { name: string } | null)?.name ?? 'Student', pct, presentCount: presentDates.size, scheduledCount: scheduledDates.size, records }
  }))

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-tranmere-blue">Attendance</h1>
      <p className="text-sm text-gray-500">Last 60 days</p>

      {studentsAttendance.map(({ sid, name, pct, presentCount, scheduledCount, records }) => (
        <div key={sid} className="bg-white border rounded-xl overflow-hidden">
          {/* Summary header */}
          <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
            <p className="font-semibold text-gray-900">{name}</p>
            <div className="text-right">
              <p className={`text-lg font-bold ${pct !== null && pct >= 90 ? 'text-green-600' : pct !== null && pct >= 75 ? 'text-amber-600' : 'text-red-600'}`}>
                {pct !== null ? `${pct}%` : 'N/A'}
              </p>
              <p className="text-xs text-gray-400">{presentCount}/{scheduledCount} sessions</p>
            </div>
          </div>

          {/* Table */}
          {records.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b">
                    <th className="px-4 py-2 font-medium">Date</th>
                    <th className="px-4 py-2 font-medium">Session</th>
                    <th className="px-4 py-2 font-medium">Type</th>
                    <th className="px-4 py-2 font-medium text-center">AM</th>
                    <th className="px-4 py-2 font-medium text-center">PM</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r, i) => (
                    <tr key={i} className={`border-b last:border-0 ${!r.am_checked_at && !r.pm_checked_at ? 'bg-red-50' : ''}`}>
                      <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap">
                        {new Date(r.attendance_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </td>
                      <td className="px-4 py-2.5 text-gray-700">{r.session_label}</td>
                      <td className="px-4 py-2.5 text-gray-400 capitalize">{r.session_type}</td>
                      <td className="px-4 py-2.5 text-center">
                        <div className="flex justify-center">
                          <AttendanceBadge checked={!!r.am_checked_at} />
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <div className="flex justify-center">
                          <AttendanceBadge checked={!!r.pm_checked_at} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="p-4 text-sm text-gray-400">No sessions in the last 60 days.</p>
          )}
        </div>
      ))}
    </div>
  )
}
