import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plus, ShieldAlert } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getRedFlags, SURVEY_QUESTIONS } from '@/lib/wellbeing/wellbeingUtils'
import { SafeguardingConcern } from '@/lib/safeguarding/safeguardingUtils'
import { ConcernList, SuggestedConcern } from '@/components/admin/safeguarding/ConcernList'

export const dynamic = 'force-dynamic'

type FlagSurvey = {
  student_id: string
  sent_at: string
  users: { name: string } | null
  wellbeing_responses: { question_key: string; score: number }[]
}

export default async function AdminSafeguardingPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin-login')

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || profile.role !== 'admin') redirect('/admin/dashboard')

  // Existing concerns
  const { data: concernRows } = await admin
    .from('safeguarding_concerns')
    .select('*')
    .order('created_at', { ascending: false })

  const concerns = (concernRows ?? []) as SafeguardingConcern[]

  // Student name lookup
  const studentNames: Record<string, string> = {}
  const studentIds = Array.from(new Set(concerns.map(c => c.student_id)))
  if (studentIds.length > 0) {
    const { data: users } = await admin
      .from('users')
      .select('id, name')
      .in('id', studentIds)
    for (const u of users ?? []) {
      studentNames[u.id as string] = (u.name as string) ?? 'Unknown'
    }
  }

  // Suggested concerns from recent low wellbeing scores (most recent survey per student)
  const { data: surveyRows } = await admin
    .from('wellbeing_surveys')
    .select('student_id, sent_at, users!student_id(name), wellbeing_responses(question_key, score)')
    .order('sent_at', { ascending: false })
    .limit(200)

  const surveys = (surveyRows ?? []) as unknown as FlagSurvey[]
  const seenStudents = new Set<string>()
  const suggestions: SuggestedConcern[] = []
  for (const s of surveys) {
    if (seenStudents.has(s.student_id)) continue
    seenStudents.add(s.student_id)
    const flags = getRedFlags(s.wellbeing_responses)
    if (flags.length === 0) continue
    const reasons = flags
      .map(f => {
        const q = SURVEY_QUESTIONS.find(sq => sq.key === f.question_key)
        return `${q?.label ?? f.question_key} (${f.score}/5)`
      })
      .join(', ')
    suggestions.push({
      studentId: s.student_id,
      studentName: s.users?.name ?? 'Unknown student',
      reason: `Low wellbeing: ${reasons}`,
    })
  }

  return (
    <div className="space-y-5 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-tranmere-blue">
            <ShieldAlert size={20} /> Safeguarding
          </h1>
          <p className="text-sm text-muted-foreground">Track and manage safeguarding concerns</p>
        </div>
        <Link
          href="/admin/safeguarding/new"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-tranmere-blue px-3 py-2 text-sm font-semibold text-white active:opacity-90"
        >
          <Plus size={16} /> New
        </Link>
      </div>

      <ConcernList concerns={concerns} studentNames={studentNames} suggestions={suggestions} />
    </div>
  )
}
