import { createClient } from '@/lib/supabase/server'
import { ProfileClient } from './ProfileClient'
import { PlayerAttributesForm } from '@/components/PlayerAttributesForm'

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
    </div>
  )
}
