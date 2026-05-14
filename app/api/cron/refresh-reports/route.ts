// Vercel Cron: 02:00 daily — regenerates stale AI reports for active players,
// then pushes a notification if high-priority development areas were found.
import { createAdminClient } from '@/lib/supabase/admin'
import { generateAndPersistReport } from '@/lib/ai/player-report'
import { sendPushNotification } from '@/lib/webpush'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  // Fail closed: if CRON_SECRET is unset the endpoint is locked, not open
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const staleThreshold = new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString()

  // 1. Get all students
  const { data: students } = await admin
    .from('users')
    .select('id, name')
    .eq('role', 'student')

  if (!students?.length) return NextResponse.json({ processed: 0, refreshed: 0, skipped: 0 })

  // 2. Get existing reports so we can skip fresh ones
  const { data: existingReports } = await admin
    .from('ai_player_reports')
    .select('student_id, generated_at')
    .in('student_id', students.map(s => s.id))

  const reportMap = new Map(
    (existingReports ?? []).map(r => [r.student_id, r.generated_at])
  )

  const results = { processed: 0, refreshed: 0, skipped: 0, errors: 0 }

  for (const student of students) {
    results.processed++

    // Skip if report is fresh (< 23h old)
    const lastGenerated = reportMap.get(student.id)
    if (lastGenerated && lastGenerated > staleThreshold) {
      results.skipped++
      continue
    }

    try {
      const result = await generateAndPersistReport(student.id)

      if (!result) {
        // No data logged — nothing to report
        results.skipped++
      } else {
        results.refreshed++

        // 3. Agentic step: if high-priority development area found → push notification to player
        const highPriority = result.report.development_areas?.find(d => d.priority === 'high')
        if (highPriority) {
          const { data: subs } = await admin
            .from('push_subscriptions')
            .select('endpoint, p256dh, auth')
            .eq('user_id', student.id)

          if (subs?.length) {
            const firstName = student.name?.split(' ')[0] ?? 'Player'
            await Promise.allSettled(
              subs.map(sub =>
                sendPushNotification(
                  { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
                  {
                    title: `${firstName}, your weekly focus is ready`,
                    body: `Priority: ${highPriority.area} — ${highPriority.this_week_action}`,
                    url: '/ai-report',
                  },
                )
              )
            )
          }
        }
      }
    } catch (err: unknown) {
      results.errors++
      console.error(
        `[refresh-reports] Failed for student ${student.id}:`,
        err instanceof Error ? err.message : err,
      )
    }

    // Rate-limit guard: always delay between students, even on error
    await new Promise(r => setTimeout(r, 500))
  }

  return NextResponse.json(results)
}
