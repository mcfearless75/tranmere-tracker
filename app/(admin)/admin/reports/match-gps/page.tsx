import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { MatchGpsReport } from './MatchGpsReport'

export const dynamic = 'force-dynamic'

function iso(d: Date) {
  return d.toISOString().slice(0, 10)
}

export default async function MatchGpsReportPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; q?: string }>
}) {
  const sp = await searchParams
  const date = sp.date || '2026-09-16'
  const q = (sp.q || 'Oldham').trim()

  const supabase = createAdminClient()
  const from = iso(new Date(new Date(date).getTime() - 2 * 86400000))
  const to = iso(new Date(new Date(date).getTime() + 2 * 86400000))

  const { data: sessions } = await supabase
    .from('gps_sessions')
    .select(
      'id, player_id, session_date, session_label, total_distance_m, hsr_distance_m, sprint_distance_m, max_speed_kmh, sprint_count, player_load, duration_mins, accel_count, decel_count, users:player_id(name)'
    )
    .gte('session_date', from)
    .lte('session_date', to)
    .order('total_distance_m', { ascending: false })

  const needle = q.toLowerCase()
  const rows = (sessions ?? []).filter((s) => {
    const label = String(s.session_label ?? '').toLowerCase()
    const onDay = s.session_date === date
    if (!needle) return onDay
    return onDay || label.includes(needle)
  })

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 print:block">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-tranmere-blue">Match GPS report</p>
          <h1 className="text-2xl font-bold text-gray-900">TR Prem vs {q || 'Opposition'}</h1>
          <p className="text-sm text-muted-foreground">{date}</p>
        </div>
        <Link href="/admin/reports" className="text-sm text-tranmere-blue underline print:hidden">
          All reports
        </Link>
      </div>
      <MatchGpsReport initialDate={date} initialQ={q} rows={rows as any[]} />
    </div>
  )
}
