import { createClient } from '@/lib/supabase/server'
import { ProfileClient } from './ProfileClient'

export default async function ProfilePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: profile }, { data: courses }] = await Promise.all([
    supabase
      .from('users')
      .select('id, name, email, role, course_id, avatar_url, courses(name)')
      .eq('id', user!.id)
      .single(),
    supabase.from('courses').select('id, name').order('name'),
  ])

  return (
    <ProfileClient
      profile={profile as any}
      courses={courses ?? []}
    />
  )
}
