import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Image from 'next/image'
import Link from 'next/link'
import { PushOptIn } from '@/components/PushOptIn'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let { data: profile } = await supabase
    .from('users')
    .select('name, course_id, avatar_url, courses(name)')
    .eq('id', user!.id)
    .single()

  // If profile missing, try via service client (RLS might be hiding it)
  if (!profile) {
    const adminClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data: existing } = await adminClient
      .from('users')
      .select('name, course_id, avatar_url, role')
      .eq('id', user!.id)
      .single()
    if (existing) {
      profile = existing as any
    } else {
      // Truly missing — INSERT (never upsert/overwrite existing roles)
      const displayName = (user!.user_metadata as any)?.full_name ?? user!.email?.split('@')[0] ?? 'Player'
      await adminClient.from('users').insert({
        id: user!.id,
        email: user!.email ?? '',
        name: displayName,
        role: 'student',
      })
      profile = { name: displayName, course_id: null, avatar_url: null, courses: null } as any
    }
  }

  const today = new Date().toISOString().split('T')[0]
  const in14 = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]

  const { data: upcoming } = await supabase
    .from('assignments')
    .select('id, title, due_date')
    .gte('due_date', today)
    .lte('due_date', in14)
    .order('due_date')
    .limit(3)

  const { data: todayFood } = await supabase
    .from('nutrition_logs')
    .select('calories')
    .eq('student_id', user!.id)
    .eq('logged_date', today)

  const totalCalories = todayFood?.reduce((sum, r) => sum + r.calories, 0) ?? 0

  const { data: lastTraining } = await supabase
    .from('training_logs')
    .select('session_type, session_date, duration_mins')
    .eq('student_id', user!.id)
    .order('session_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  const firstName = profile?.name?.split(' ')[0] ?? 'Player'
  const courseName = (profile?.courses as any)?.name ?? ''
  const avatarUrl = profile?.avatar_url
  const initials = profile?.name
    ? profile.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'P'

  return (
    <div className="space-y-4">
      {/* Header with user avatar */}
      <div className="flex items-center gap-3 py-2">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={profile?.name ?? 'You'}
            className="w-12 h-12 rounded-full object-cover ring-2 ring-tranmere-blue shadow"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-tranmere-blue to-blue-900 flex items-center justify-center ring-2 ring-tranmere-blue shadow">
            <span className="text-white font-bold text-sm">{initials}</span>
          </div>
        )}
        <div className="flex-1">
          <h1 className="text-lg font-bold text-tranmere-blue">Hi, {firstName}</h1>
          {courseName && <p className="text-xs text-muted-foreground">{courseName}</p>}
        </div>
        <Image
          src="https://upload.wikimedia.org/wikipedia/en/thumb/5/55/Tranmere_Rovers_FC_crest.svg/960px-Tranmere_Rovers_FC_crest.svg.png"
          alt="Tranmere Rovers"
          width={32}
          height={32}
          className="opacity-80"
        />
      </div>

      {/* Upcoming Deadlines */}
      <Card>
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Upcoming Deadlines
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 pb-4">
          {upcoming?.length ? upcoming.map(a => {
            const daysLeft = Math.ceil((new Date(a.due_date).getTime() - Date.now()) / 86400000)
            return (
              <Link key={a.id} href="/coursework" className="flex justify-between items-center text-sm py-1">
                <span className="font-medium truncate pr-2">{a.title}</span>
                <span className={`shrink-0 text-xs font-medium ${daysLeft <= 3 ? 'text-red-600' : 'text-muted-foreground'}`}>
                  {daysLeft === 0 ? 'Today' : daysLeft === 1 ? 'Tomorrow' : `${daysLeft}d`}
                </span>
              </Link>
            )
          }) : (
            <p className="text-sm text-muted-foreground">No deadlines in the next 14 days</p>
          )}
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Today&apos;s calories</p>
            <p className="text-2xl font-bold text-tranmere-blue">{totalCalories.toLocaleString()}</p>
            <Link href="/nutrition" className="text-xs text-tranmere-blue underline underline-offset-2 mt-1 inline-block">
              Log food →
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Last session</p>
            {lastTraining ? (
              <>
                <p className="text-sm font-bold leading-tight">{lastTraining.session_type}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{lastTraining.duration_mins} mins</p>
              </>
            ) : (
              <Link href="/training" className="text-xs text-tranmere-blue underline underline-offset-2 inline-block mt-1">
                Log session →
              </Link>
            )}
          </CardContent>
        </Card>
      </div>

      <PushOptIn />
    </div>
  )
}
