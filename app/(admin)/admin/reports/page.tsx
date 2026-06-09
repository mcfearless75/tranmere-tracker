import Link from 'next/link'
import { Activity, Heart, Wrench, ArrowRight, Sparkles } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export default async function ReportsHubPage() {
  const supabase = createAdminClient()

  const { count: gpsCount } = await supabase
    .from('gps_sessions')
    .select('*', { count: 'exact', head: true })

  const tiles = [
    {
      href: '/admin/reports/ai-cohort',
      icon: Sparkles,
      title: 'AI Cohort Report',
      desc: 'Claude-written executive summary across attendance, GPS, wellbeing and match form',
      gradient: 'from-indigo-500 to-fuchsia-600',
      stat: 'AI-generated · All / Y1 / Y2',
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
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-tranmere-blue">Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Deep insights across GPS, matches, and engagement.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
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
