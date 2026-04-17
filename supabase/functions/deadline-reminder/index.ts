// Tranmere Tracker — Deadline Reminder Edge Function
// Deploy with: npx supabase functions deploy deadline-reminder
// This function is called by the pg_cron job in 002_deadline_cron.sql

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const APP_URL = Deno.env.get('APP_URL') ?? ''

Deno.serve(async () => {
  const today = new Date()

  for (const daysAway of [7, 1]) {
    const target = new Date(today)
    target.setDate(today.getDate() + daysAway)
    const targetDate = target.toISOString().split('T')[0]
    const label = daysAway === 1 ? 'tomorrow' : 'in 7 days'

    const { data: assignments } = await supabase
      .from('assignments')
      .select('id, title, submissions(student_id, status)')
      .eq('due_date', targetDate)

    for (const assignment of assignments ?? []) {
      const subs = (assignment.submissions as any[]) ?? []
      // Only notify students who haven't submitted yet
      const pendingStudentIds = subs
        .filter((s: any) => !['submitted', 'graded'].includes(s.status))
        .map((s: any) => s.student_id)

      if (pendingStudentIds.length === 0) continue

      // Call our app's push/send API using shared cron secret
      await fetch(`${APP_URL}/api/push/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-cron-secret': Deno.env.get('CRON_SECRET') ?? '',
        },
        body: JSON.stringify({
          title: `Assignment due ${label}!`,
          body: assignment.title,
          targetUserIds: pendingStudentIds,
        }),
      })
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
