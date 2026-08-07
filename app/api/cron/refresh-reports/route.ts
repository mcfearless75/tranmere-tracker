// Vercel Cron: 02:00 daily — regenerates stale AI reports for active players,
// then pushes a notification if high-priority development areas were found.
import { createAdminClient } from '@/lib/supabase/admin'
import { generateAndPersistReport } from '@/lib/ai/player-report'
import { sendPushNotification } from '@/lib/webpush'
import { verifyCronSecret } from '@/lib/security'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
// Vercel function cap — without this the route inherits the default (often 10-60s)
// or, on plans where 300 is the max, documents the ceiling we budget against below.
export const maxDuration = 300

// Stop starting new students once this much wall-clock time has elapsed.
// Leaves ~30s headroom under the 300s cap for the in-flight AI call, the
// persistence upsert, and push notifications, so the run always exits cleanly
// with a summary instead of being killed by the platform timeout.
const TIME_BUDGET_MS = 270_000

export async function GET(request: Request) {
  const startedAt = Date.now()

  // Fail closed: if CRON_SECRET is unset the endpoint is locked, not open
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const staleThreshold = new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString()

  // 1. Get all students
  const { data: students } = await admin
    .from('users')
    .select('id, name')
    .eq('role', 'student')

  if (!students?.length) {
    return NextResponse.json({ processed: 0, refreshed: 0, skipped: 0, deferred: 0, errors: 0 })
  }

  // 2. Get existing reports so we can skip fresh ones
  const { data: existingReports } = await admin
    .from('ai_player_reports')
    .select('student_id, generated_at')
    .in('student_id', students.map(s => s.id))

  const reportMap = new Map(
    (existingReports ?? []).map(r => [r.student_id, r.generated_at])
  )

  // Fresh reports (< 23h old) are skipped without work. The rest are processed
  // OLDEST report first (no report at all sorts before everything), so when a
  // run hits the time budget, the students it deferred are the freshest — the
  // next nightly run picks up the oldest again and the backlog drains across
  // nights instead of the same tail of students starving forever.
  const staleStudents = students
    .filter(s => {
      const last = reportMap.get(s.id)
      return !last || last <= staleThreshold
    })
    .sort((a, b) =>
      (reportMap.get(a.id) ?? '').localeCompare(reportMap.get(b.id) ?? '')
    )

  const results = {
    processed: 0,
    refreshed: 0,
    skipped: students.length - staleStudents.length, // fresh reports
    deferred: 0,
    errors: 0,
  }

  for (const student of staleStudents) {
    // Out of time budget: defer the remainder to the next nightly run.
    if (Date.now() - startedAt > TIME_BUDGET_MS) {
      results.deferred = staleStudents.length - results.processed
      break
    }

    results.processed++

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

  // Single summary line instead of erroring out — deferred > 0 is expected
  // behaviour on nights with a large backlog, not a failure.
  console.log(
    `[refresh-reports] Summary: processed=${results.processed} refreshed=${results.refreshed} ` +
    `skipped=${results.skipped} deferred=${results.deferred} errors=${results.errors} ` +
    `elapsed=${Math.round((Date.now() - startedAt) / 1000)}s`
  )

  return NextResponse.json(results)
}
