import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ClipboardList, Heart, ClipboardCheck, ShieldAlert,
  Satellite, CalendarDays, Calendar, Users, CheckCircle2, ChevronRight,
} from 'lucide-react'
import { londonDateISO } from '@/lib/dates'
import { PHASE_LABELS, type PhaseWindows } from '@/lib/attendance/phase'
import { buildStudentDayStatus, missingStudents, exceptionsWindowPhase, type Phase } from '@/lib/attendance/dayStatus'
import { mondayOf, shiftDate } from '@/lib/attendance/weeklyReport'
import { buildWellbeingFlags } from '@/lib/wellbeing/wellbeingUtils'
import { buildReviewsDue } from '@/lib/staff/exceptionsHome'
import { MissingRowActions } from '@/components/attendance/MissingRowActions'

export const dynamic = 'force-dynamic'

const MISSING_CAP = 20
const WELLBEING_CAP = 10
const SAFEGUARDING_CAP = 10

export default async function StaffHomePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const now = new Date()
  const today = londonDateISO(now)
  const dateLabel = new Date(today + 'T12:00:00').toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  const [{ data: settings }, { data: students }] = await Promise.all([
    admin
      .from('academy_settings')
      .select('am_window_start, am_window_end, lunch_window_start, lunch_window_end, pm_window_start, pm_window_end')
      .eq('id', 1)
      .maybeSingle(),
    admin.from('users').select('id, name').eq('role', 'student').eq('is_active', true),
  ])

  const windows: PhaseWindows = {
    am:    { start: settings?.am_window_start    ?? '07:30', end: settings?.am_window_end    ?? '10:30' },
    lunch: { start: settings?.lunch_window_start ?? '11:00', end: settings?.lunch_window_end ?? '14:30' },
    pm:    { start: settings?.pm_window_start    ?? '14:30', end: settings?.pm_window_end    ?? '17:30' },
  }
  const nameById = new Map((students ?? []).map(s => [s.id, s.name]))
  const windowPhase = exceptionsWindowPhase(windows, now)

  // ── Block 1: missing this window ──────────────────────────────────────
  let missing: { studentId: string; name: string }[] = []
  if (windowPhase) {
    const [{ data: records }, { data: excusals }] = await Promise.all([
      admin
        .from('daily_attendance')
        .select('student_id, am_checked_at, lunch_checked_at, pm_checked_at, am_is_flagged, lunch_is_flagged, pm_is_flagged')
        .eq('attendance_date', today),
      admin
        .from('attendance_excusals')
        .select('student_id, phases')
        .eq('excused_date', today),
    ])
    const recMap = new Map((records ?? []).map(r => [r.student_id, r]))
    const excusalMap = new Map((excusals ?? []).map(e => [e.student_id, e.phases as Phase[]]))
    const roster = (students ?? []).map(s => {
      const r = recMap.get(s.id)
      return buildStudentDayStatus(
        s.id,
        {
          am:    { checkedAt: r?.am_checked_at ?? null,    isFlagged: r?.am_is_flagged ?? false,    flagReason: null },
          lunch: { checkedAt: r?.lunch_checked_at ?? null, isFlagged: r?.lunch_is_flagged ?? false, flagReason: null },
          pm:    { checkedAt: r?.pm_checked_at ?? null,    isFlagged: r?.pm_is_flagged ?? false,    flagReason: null },
        },
        windows,
        now,
        excusalMap.get(s.id) ?? [],
      )
    })
    missing = missingStudents(roster, windowPhase)
      .map(s => ({ studentId: s.studentId, name: nameById.get(s.studentId) ?? 'Unknown' }))
  }

  // ── Block 2: wellbeing flags ───────────────────────────────────────────
  const monday = mondayOf(today)
  const { data: surveys } = await admin
    .from('wellbeing_surveys')
    .select('student_id, status, users!student_id(name), wellbeing_responses(question_key, score)')
    .gte('sent_at', monday)
  const wellbeingFlags = buildWellbeingFlags(
    (surveys ?? []).map(s => ({
      studentId: s.student_id,
      name: (s.users as unknown as { name: string } | null)?.name ?? 'Unknown',
      status: s.status,
      responses: s.wellbeing_responses,
    }))
  )

  // ── Block 3: reviews due (next 14 days, overdue included) ─────────────
  const horizon = shiftDate(today, 14)
  const { data: reviews } = await admin
    .from('learner_reviews')
    .select('id, student_id, status, scheduled_for, users!student_id(name)')
    .neq('status', 'complete')
    .lte('scheduled_for', horizon)
  const reviewsDue = buildReviewsDue(
    (reviews ?? []).map(r => ({
      id: r.id,
      student_id: r.student_id,
      name: (r.users as unknown as { name: string } | null)?.name ?? 'Unknown',
      status: r.status,
      scheduled_for: r.scheduled_for,
    })),
    today,
  )

  // ── Block 4: open safeguarding cases (cheap status filter — no new table) ──
  const { data: concerns } = await admin
    .from('safeguarding_concerns')
    .select('id, student_id, category, severity, users!student_id(name)')
    .neq('status', 'closed')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-5 pb-24 md:pb-6">
      <div className="flex items-center gap-2">
        <ClipboardList size={20} className="text-tranmere-blue" />
        <div>
          <h1 className="text-lg font-bold text-tranmere-blue">Home</h1>
          <p className="text-xs text-muted-foreground">{dateLabel}</p>
        </div>
      </div>

      <ExceptionBlock
        icon={<ClipboardList size={15} className="text-tranmere-blue" />}
        title={windowPhase ? `Missing this window — ${PHASE_LABELS[windowPhase]}` : 'Missing this window'}
        items={missing.slice(0, MISSING_CAP).map(m => ({
          key: m.studentId,
          label: m.name,
          actions: windowPhase
            ? <MissingRowActions studentId={m.studentId} studentName={m.name} date={today} phase={windowPhase} />
            : undefined,
        }))}
        total={missing.length}
        cap={MISSING_CAP}
        viewAllHref="/admin/attendance"
        emptyLabel={windowPhase ? 'All clear' : 'No check-in window active'}
      />

      <ExceptionBlock
        icon={<Heart size={15} className="text-rose-600" />}
        title="Wellbeing flags"
        items={wellbeingFlags.slice(0, WELLBEING_CAP).map(f => ({
          key: f.studentId,
          label: f.name,
          meta: f.reason === 'incomplete' ? 'Survey not completed' : 'Low mood/stress score',
        }))}
        total={wellbeingFlags.length}
        cap={WELLBEING_CAP}
        viewAllHref="/admin/wellbeing"
        emptyLabel="All clear"
      />

      <ExceptionBlock
        icon={<ClipboardCheck size={15} className="text-purple-600" />}
        title="Reviews due"
        items={reviewsDue.map(r => ({
          key: r.id,
          label: r.name,
          meta: r.overdue ? 'Overdue' : r.scheduledFor ?? undefined,
          warn: r.overdue,
        }))}
        total={reviewsDue.length}
        viewAllHref="/admin/students"
        emptyLabel="All clear"
      />

      <ExceptionBlock
        icon={<ShieldAlert size={15} className="text-amber-600" />}
        title="Safeguarding — open cases"
        items={(concerns ?? []).slice(0, SAFEGUARDING_CAP).map(c => ({
          key: c.id,
          label: (c.users as unknown as { name: string } | null)?.name ?? 'Unknown',
          meta: c.category,
        }))}
        total={(concerns ?? []).length}
        cap={SAFEGUARDING_CAP}
        viewAllHref="/admin/safeguarding"
        emptyLabel="All clear"
      />

      {/* Footer — the sitemap; the top is exceptions */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 pt-2">
        <ToolLink href="/admin/gps-dashboard" icon={<Satellite size={18} />} label="GPS" />
        <ToolLink href="/admin/attendance/calendar" icon={<CalendarDays size={18} />} label="Calendar" />
        <ToolLink href="/admin/match-events" icon={<Calendar size={18} />} label="Matches" />
        <ToolLink href="/admin/wellbeing" icon={<Heart size={18} />} label="Wellbeing" />
        <ToolLink href="/admin/students" icon={<Users size={18} />} label="Students" />
      </div>
    </div>
  )
}

function ExceptionBlock({
  icon, title, items, total, cap, viewAllHref, emptyLabel,
}: {
  icon: React.ReactNode
  title: string
  items: { key: string; label: string; meta?: string; warn?: boolean; actions?: React.ReactNode }[]
  total: number
  cap?: number
  viewAllHref: string
  emptyLabel: string
}) {
  return (
    <div className="rounded-2xl border bg-white p-4 space-y-2.5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold flex items-center gap-2">{icon} {title}</p>
        {total > 0 && <span className="text-xs font-bold text-muted-foreground">{total}</span>}
      </div>

      {items.length === 0 ? (
        <p className="flex items-center gap-1.5 text-sm text-green-700">
          <CheckCircle2 size={15} /> {emptyLabel}
        </p>
      ) : (
        <ul className="divide-y">
          {items.map(item => (
            <li key={item.key} className="flex items-center justify-between gap-2 py-1.5 text-sm flex-wrap">
              <span className="font-medium truncate">{item.label}</span>
              <span className="flex items-center gap-2 shrink-0 ml-auto">
                {item.meta && (
                  <span className={`text-xs ${item.warn ? 'text-red-600 font-semibold' : 'text-muted-foreground'}`}>
                    {item.meta}
                  </span>
                )}
                {item.actions}
              </span>
            </li>
          ))}
        </ul>
      )}

      {cap !== undefined && total > cap && (
        <Link href={viewAllHref} className="flex items-center gap-1 text-xs font-semibold text-tranmere-blue">
          View all <ChevronRight size={12} />
        </Link>
      )}
    </div>
  )
}

function ToolLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href} className="flex flex-col items-center gap-1.5 rounded-xl border bg-white p-3 text-center hover:bg-gray-50 transition-colors">
      <span className="text-tranmere-blue">{icon}</span>
      <span className="text-[11px] font-medium">{label}</span>
    </Link>
  )
}
