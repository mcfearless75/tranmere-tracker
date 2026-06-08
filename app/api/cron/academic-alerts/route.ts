import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildOverdueAlerts } from '@/lib/alerts/alertsUtils'

export const runtime = 'nodejs'

interface AssignmentJoinRow {
  student_id: string
  title: string
  due_date: string
  status: string
  profiles: {
    full_name: string | null
  } | null
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()
    const now = new Date()

    const { data, error } = await supabase
      .from('assignments')
      .select('student_id, title, due_date, status, profiles(full_name)')
      .lt('due_date', now.toISOString())
      .not('status', 'in', '("submitted","graded")')

    if (error) {
      return NextResponse.json(
        { error: 'Database query failed', detail: error.message },
        { status: 500 },
      )
    }

    const rows = (data as unknown as AssignmentJoinRow[] | null) ?? []

    const normalised = rows.map((row) => ({
      student_id: row.student_id,
      student_name: row.profiles?.full_name ?? 'Unknown Student',
      title: row.title,
      due_date: row.due_date,
      status: row.status,
    }))

    const alerts = buildOverdueAlerts(normalised, now)

    return NextResponse.json({ processed: alerts.length, alerts })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
