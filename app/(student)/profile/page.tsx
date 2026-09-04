import { createClient } from '@/lib/supabase/server'
import { ProfileClient } from './ProfileClient'
import { PlayerAttributesForm } from '@/components/PlayerAttributesForm'
import { InstallAppButton } from '@/components/pwa/InstallGuide'
import { ChangePinForm } from '@/components/account/ChangePinForm'
import { KeyRound } from 'lucide-react'

export default async function ProfilePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [{ data: profile }, { data: courses }] = await Promise.all([
    supabase
      .from('users')
      .select('id, name, email, role, course_id, avatar_url, courses(name), date_of_birth, position, height_cm, weight_kg, build, dominant_foot')
      .eq('id', user.id)
      .single(),
    supabase.from('courses').select('id, name').order('name'),
  ])

  // Auto-create profile row if trigger didn't fire on signup
  let resolvedProfile = profile
  if (!resolvedProfile) {
    const name = user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'Student'
    await supabase.from('users').upsert({
      id: user.id,
      email: user.email ?? '',
      name,
      role: 'student',
    })
    const { data: created } = await supabase
      .from('users')
      .select('id, name, email, role, course_id, avatar_url, courses(name), date_of_birth, position, height_cm, weight_kg, build, dominant_foot')
      .eq('id', user.id)
      .single()
    resolvedProfile = created
  }

  const fallback = {
    id: user.id,
    name: user.user_metadata?.full_name ?? null,
    email: user.email ?? null,
    role: 'student',
    course_id: null,
    avatar_url: null,
    courses: null,
  }

  const p = (resolvedProfile ?? fallback) as any

  return (
    <div className="space-y-5">
      <ProfileClient profile={p} courses={courses ?? []} />

      {/* PIN-login accounts (username@tranmeretracker.internal) can change
          their own PIN here anytime. Real-email/Google-SSO accounts don't
          use a PIN, so this is hidden for them. */}
      {typeof p.email === 'string' && p.email.endsWith('@tranmeretracker.internal') && (
        <div className="rounded-2xl border bg-white p-4 space-y-3">
          <div className="flex items-center gap-2">
            <KeyRound size={16} className="text-tranmere-blue" />
            <h2 className="font-semibold text-sm">Change my PIN</h2>
          </div>
          <ChangePinForm />
        </div>
      )}

      {p.role === 'student' && (
        <PlayerAttributesForm
          attributes={{
            date_of_birth: p.date_of_birth ?? null,
            position:      p.position ?? null,
            height_cm:     p.height_cm ?? null,
            weight_kg:     p.weight_kg ?? null,
            build:         p.build ?? null,
            dominant_foot: p.dominant_foot ?? null,
          }}
        />
      )}

      {/* Hidden automatically when already installed or in the native app */}
      <div className="flex justify-center pb-2">
        <InstallAppButton />
      </div>
    </div>
  )
}
