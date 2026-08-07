import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Settings, ArrowLeft } from 'lucide-react'
import { SettingsForm } from './SettingsForm'

export const dynamic = 'force-dynamic'

const hhmm = (t: string | null | undefined) => (t ?? '').substring(0, 5)

export default async function AttendanceSettingsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (!profile || !['admin', 'coach', 'teacher'].includes(profile.role)) {
    redirect('/admin/attendance')
  }

  const { data: settings } = await admin
    .from('academy_settings')
    .select('am_window_start, am_window_end, lunch_window_start, lunch_window_end, pm_window_start, pm_window_end, geo_lat, geo_lng, radius_m, nfc_token')
    .eq('id', 1)
    .maybeSingle()

  if (!settings) {
    return <p className="text-sm text-red-600">Academy settings row missing — run migrations.</p>
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Settings size={24} className="text-tranmere-blue shrink-0" />
          <div>
            <h1 className="text-xl font-bold text-tranmere-blue">Attendance Settings</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Check-in windows, geofence and NFC token for the daily tap system.
            </p>
          </div>
        </div>
        <Link href="/admin/attendance" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-tranmere-blue transition-colors shrink-0">
          <ArrowLeft size={14} />
          Attendance
        </Link>
      </div>

      <SettingsForm
        initial={{
          am_window_start: hhmm(settings.am_window_start),
          am_window_end: hhmm(settings.am_window_end),
          lunch_window_start: hhmm(settings.lunch_window_start),
          lunch_window_end: hhmm(settings.lunch_window_end),
          pm_window_start: hhmm(settings.pm_window_start),
          pm_window_end: hhmm(settings.pm_window_end),
          geo_lat: settings.geo_lat,
          geo_lng: settings.geo_lng,
          radius_m: settings.radius_m,
        }}
        // The token is only ever sent to the browser for admins — staff below
        // admin never receive it in the payload at all.
        nfcToken={profile.role === 'admin' ? settings.nfc_token : null}
      />
    </div>
  )
}
