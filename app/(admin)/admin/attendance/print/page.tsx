import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Image from 'next/image'
import { PrintToolbar } from './PrintToolbar'

export const dynamic = 'force-dynamic'

function fmtTime(iso: string | null) {
  return iso ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—'
}

export default async function PrintAttendancePage({
  searchParams,
}: {
  searchParams: { date?: string; phase?: 'am' | 'pm' | 'both' }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const today = new Date().toISOString().split('T')[0]
  const date  = searchParams.date  ?? today
  const phase = searchParams.phase ?? 'both'

  const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const [{ data: students }, { data: records }] = await Promise.all([
    admin.from('users').select('id, name').eq('role', 'student').order('name'),
    admin
      .from('daily_attendance')
      .select('student_id, am_checked_at, pm_checked_at, am_is_flagged, pm_is_flagged, am_flag_reason, pm_flag_reason')
      .eq('attendance_date', date),
  ])

  const recMap = new Map((records ?? []).map(r => [r.student_id, r]))

  const rows = (students ?? []).map(s => {
    const r = recMap.get(s.id)
    return {
      name: s.name,
      am:   r?.am_checked_at ?? null,
      pm:   r?.pm_checked_at ?? null,
      am_flagged: r?.am_is_flagged ?? false,
      pm_flagged: r?.pm_is_flagged ?? false,
      am_reason:  r?.am_flag_reason ?? null,
      pm_reason:  r?.pm_flag_reason ?? null,
    }
  })

  const amIn  = rows.filter(r => r.am).length
  const pmOut = rows.filter(r => r.pm).length
  const generatedAt = new Date().toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  const showAm = phase === 'am' || phase === 'both'
  const showPm = phase === 'pm' || phase === 'both'
  const title  = phase === 'am' ? 'Morning Attendance Report'
              : phase === 'pm' ? 'End-of-Day Attendance Report'
              :                   'Daily Attendance Report'

  return (
    <div className="bg-white text-black min-h-screen p-6 max-w-[210mm] mx-auto print:p-0 print:max-w-none">
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 14mm; }
          body { background: white !important; }
          .no-print { display: none !important; }
          tr { page-break-inside: avoid; }
          thead { display: table-header-group; }
        }
      `}</style>

      <PrintToolbar backHref={`/admin/attendance?date=${date}`} />

      {/* Letterhead */}
      <header className="flex items-center justify-between border-b-2 border-black/80 pb-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tranmere Academy</h1>
          <p className="text-sm text-gray-600">{title}</p>
        </div>
        <Image
          src="https://upload.wikimedia.org/wikipedia/en/thumb/5/55/Tranmere_Rovers_FC_crest.svg/960px-Tranmere_Rovers_FC_crest.svg.png"
          alt="Tranmere Rovers"
          width={56}
          height={56}
          className="opacity-90"
        />
      </header>

      {/* Meta */}
      <section className="flex justify-between text-sm mb-5">
        <div>
          <p className="text-xs uppercase text-gray-500 tracking-wider">Date</p>
          <p className="font-bold text-base">{dateLabel}</p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase text-gray-500 tracking-wider">Generated</p>
          <p className="font-medium">{generatedAt}</p>
        </div>
      </section>

      {/* Summary */}
      <section className={`grid ${showAm && showPm ? 'grid-cols-3' : 'grid-cols-2'} gap-3 mb-5`}>
        <div className="border border-black/20 rounded-lg p-3">
          <p className="text-[10px] uppercase tracking-wider text-gray-500">Total students</p>
          <p className="text-2xl font-bold">{rows.length}</p>
        </div>
        {showAm && (
          <div className="border border-black/20 rounded-lg p-3">
            <p className="text-[10px] uppercase tracking-wider text-gray-500">Checked in (AM)</p>
            <p className="text-2xl font-bold">{amIn} <span className="text-sm text-gray-400 font-normal">/ {rows.length}</span></p>
          </div>
        )}
        {showPm && (
          <div className="border border-black/20 rounded-lg p-3">
            <p className="text-[10px] uppercase tracking-wider text-gray-500">Checked out (PM)</p>
            <p className="text-2xl font-bold">{pmOut} <span className="text-sm text-gray-400 font-normal">/ {rows.length}</span></p>
          </div>
        )}
      </section>

      {/* Roster */}
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b-2 border-black/80 text-left">
            <th className="py-2 pr-2">#</th>
            <th className="py-2 pr-2">Student</th>
            {showAm && <th className="py-2 pr-2 text-center">AM In</th>}
            {showPm && <th className="py-2 pr-2 text-center">PM Out</th>}
            <th className="py-2 pr-2">Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const note = [
              r.am_flagged ? `AM: ${r.am_reason}` : null,
              r.pm_flagged ? `PM: ${r.pm_reason}` : null,
            ].filter(Boolean).join('; ')
            return (
              <tr key={r.name} className="border-b border-black/10">
                <td className="py-1.5 pr-2 text-gray-500">{i + 1}</td>
                <td className="py-1.5 pr-2 font-medium">{r.name}</td>
                {showAm && (
                  <td className={`py-1.5 pr-2 text-center font-mono ${!r.am ? 'text-red-600 font-bold' : ''}`}>
                    {r.am ? fmtTime(r.am) : 'MISSING'}
                  </td>
                )}
                {showPm && (
                  <td className={`py-1.5 pr-2 text-center font-mono ${!r.pm ? 'text-red-600 font-bold' : ''}`}>
                    {r.pm ? fmtTime(r.pm) : 'MISSING'}
                  </td>
                )}
                <td className="py-1.5 pr-2 text-xs text-gray-600">{note}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* Sign-off line */}
      <footer className="mt-10 pt-6 border-t border-black/30 text-xs text-gray-500 flex justify-between">
        <span>Tranmere Academy · Solar Campus, 235 Leasowe Rd, Wallasey CH45 8RE</span>
        <span>Page 1</span>
      </footer>
    </div>
  )
}
