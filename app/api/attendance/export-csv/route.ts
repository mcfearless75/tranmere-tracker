import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { londonDateISO } from '@/lib/dates'
import { NextResponse } from 'next/server'
import { excusalCoversPhase, EXCUSAL_LABELS } from '@/lib/attendance/excusal'

export const dynamic = 'force-dynamic'

function csvEscape(v: string | number | null | undefined) {
  if (v === null || v === undefined) return ''
  const s = String(v)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function fmtTime(iso: string | null) {
  return iso ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' }) : ''
}

export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'coach', 'teacher'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url   = new URL(request.url)
  const date  = url.searchParams.get('date') ?? londonDateISO()

  const [{ data: students }, { data: records }, { data: excusals }] = await Promise.all([
    admin.from('users').select('id, name, email').eq('role', 'student').order('name'),
    admin
      .from('daily_attendance')
      .select('student_id, am_checked_at, lunch_checked_at, pm_checked_at, am_is_flagged, lunch_is_flagged, pm_is_flagged, am_flag_reason, lunch_flag_reason, pm_flag_reason')
      .eq('attendance_date', date),
    admin
      .from('attendance_excusals')
      .select('student_id, reason, phases')
      .eq('excused_date', date),
  ])

  const recMap = new Map((records ?? []).map(r => [r.student_id, r]))
  const excusalMap = new Map((excusals ?? []).map(e => [e.student_id, e]))

  const headers = ['Name', 'Email', 'AM In', 'Lunch', 'PM Out', 'AM Status', 'Lunch Status', 'PM Status', 'Notes']
  const lines: string[] = [headers.join(',')]

  for (const s of students ?? []) {
    const r = recMap.get(s.id)
    const excusal = excusalMap.get(s.id)
    const note = [
      r?.am_is_flagged ? `AM: ${r.am_flag_reason}` : null,
      r?.lunch_is_flagged ? `Lunch: ${r.lunch_flag_reason}` : null,
      r?.pm_is_flagged ? `PM: ${r.pm_flag_reason}` : null,
    ].filter(Boolean).join('; ')

    const status = (checkedAt: string | null | undefined, phase: 'am' | 'lunch' | 'pm') => {
      if (checkedAt) return 'Present'
      if (excusalCoversPhase(excusal, phase)) return EXCUSAL_LABELS[(excusal!.reason ?? 'other') as keyof typeof EXCUSAL_LABELS] ?? 'Excused'
      return 'Missing'
    }

    lines.push([
      s.name,
      s.email,
      fmtTime(r?.am_checked_at ?? null),
      fmtTime(r?.lunch_checked_at ?? null),
      fmtTime(r?.pm_checked_at ?? null),
      status(r?.am_checked_at, 'am'),
      status(r?.lunch_checked_at, 'lunch'),
      status(r?.pm_checked_at, 'pm'),
      note,
    ].map(csvEscape).join(','))
  }

  const csv = lines.join('\n')

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="attendance-${date}.csv"`,
    },
  })
}
