import Link from 'next/link'
import { GraduationCap, Activity, BookOpen, Heart, Wrench, ArrowRight } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export default async function ReportsHubPage() {
  const supabase = createAdminClient()

  const [
    { count: studentCount },
    { count: assignmentCount },
    { count: submissionCount },
    { count: gpsCount },
  ] = await Promise.all([
    supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'student'),
    supabase.from('assignments').select('*', { count: 'exact', head: true }),
    supabase.from('submissions').select('*', { count: 'exact', head: true }),
    supabase.from('gps_sessions').select('*', { count: 'exact', head: true }),
  ])

  const tiles = [
    {
      href: '/admin/reports/progress',
      icon: GraduationCap,
      title: 'Student Progress',
      desc: 'Grade heatmap across all units, at-risk flags, individual drill-down',
      gradient: 'from-blue-500 to-indigo-600',
      stat: `${studentCount ?? 0} students tracked`,
    },
    {
      href: '/admin/reports/squad',
      icon: Activity,
      title: 'Squad Performance',
      desc: 'GPS trends, match ratings, top/bottom performers with team baselines',
      gradient: 'from-orange-500 to-red-600',
      stat: `${gpsCount ?? 0} GPS sessions recorded`,
    },
    {
      href: '/admin/reports/coursework',
      icon: BookOpen,
      title: 'Coursework Analytics',
      desc: 'Submission rates per unit, overdue assignments, grade distribution',
      gradient: 'from-purple-500 to-pink-600',
      stat: `${submissionCount ?? 0} submissions across ${assignmentCount ?? 0} assignments`,
    },
    {
      href: '/admin/reports/engagement',
      icon: Heart,
      title: 'Engagement',
      desc: 'Who logs nutrition & training, inactive users, weekly activity patterns',
      gradient: 'from-green-500 to-emerald-600',
      stat: 'Real-time engagement tracking',
    },
    {
      href: '/admin/reports/builder',
      icon: Wrench,
      title: 'Custom Report Builder',
      desc: 'Build your own reports with filters, metrics, and CSV export',
      gradient: 'from-gray-700 to-gray-900',
      stat: 'Unlimited custom views',
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-tranmere-blue">Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Deep insights across coursework, GPS, matches, and engagement.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tiles.map(t => (
          <Link
            key={t.href}
            href={t.href}
            className="group relative overflow-hidden rounded-2xl border bg-white p-5 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5"
          >
            <div className={`absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br ${t.gradient} opacity-10 group-hover:opacity-20 transition`} />
            <div className={`inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${t.gradient} text-white shadow-md mb-3`}>
              <t.icon size={20} />
            </div>
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-bold text-lg text-gray-900">{t.title}</h2>
              <ArrowRight size={16} className="mt-1 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition" />
            </div>
            <p className="text-sm text-muted-foreground mt-1">{t.desc}</p>
            <p className="text-xs text-tranmere-blue font-medium mt-3 pt-3 border-t">{t.stat}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
