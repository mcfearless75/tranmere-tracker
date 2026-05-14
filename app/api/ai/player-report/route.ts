import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateReport, persistReport } from '@/lib/ai/player-report'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    const admin = createAdminClient()

    // Only admin/coach/teacher may bypass the 24h cache — prevents cost abuse by students
    const forceRequested = new URL(req.url).searchParams.get('force') === '1'
    let force = false
    if (forceRequested) {
      const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single()
      force = ['admin', 'coach', 'teacher'].includes(profile?.role ?? '')
    }

    // Check cache unless force refresh
    if (!force) {
      const { data: cached } = await admin
        .from('ai_player_reports')
        .select('report_json, generated_at')
        .eq('student_id', user.id)
        .maybeSingle()

      if (cached) {
        const age = Date.now() - new Date(cached.generated_at).getTime()
        if (age < 24 * 60 * 60 * 1000) {
          return NextResponse.json({ report: cached.report_json, generated_at: cached.generated_at, cached: true })
        }
      }
    }

    const report = await generateReport(user.id)
    if (!report) {
      return NextResponse.json({ error: 'No recent training, nutrition or GPS data found — log some activity first.' }, { status: 422 })
    }

    const generatedAt = await persistReport(user.id, report)

    return NextResponse.json({ report, generated_at: generatedAt, cached: false })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
