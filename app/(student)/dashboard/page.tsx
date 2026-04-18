import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Image from 'next/image'
import Link from 'next/link'
import { PushOptIn } from '@/components/PushOptIn'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('users')
    .select('name, course_id, courses(name)')
    .eq('id', user!.id)
    .single()

  // Upcoming assignments due in next 14 days — we can't filter by course easily without join
  // so fetch all upcoming and note the student filters on their coursework page
  const today = new Date().toISOString().split('T')[0]
  const in14 = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]

  const { data: upcoming } = await supabase
    .from('assignments')
    .select('id, title, due_date')
    .gte('due_date', today)
    .lte('due_date', in14)
    .order('due_date')
    .limit(3)

  // Today's nutrition total
  const { data: todayFood } = await supabase
    .from('nutrition_logs')
    .select('calories')
    .eq('student_id', user!.id)
    .eq('logged_date', today)

  const totalCalories = todayFood?.reduce((sum, r) => sum + r.calories, 0) ?? 0

  // Latest training session
  const { data: lastTraining } = await supabase
    .from('training_logs')
    .select('session_type, session_date, duration_mins')
    .eq('student_id', user!.id)
    .order('session_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  const firstName = profile?.name?.split(' ')[0] ?? 'Athlete'
  const courseName = (profile?.courses as any)?.name ?? ''

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 py-2">
        <Image
          src="https://upload.wikimedia.org/wikipedia/en/thumb/5/55/Tranmere_Rovers_FC_crest.svg/960px-Tranmere_Rovers_FC_crest.svg.png"
          alt="Tranmere Rovers"
          width={40}
          height={40}
          className="rounded-full"
        />
        <div>
          <h1 className="text-lg font-bold text-tranmere-blue">Hi, {firstName}</h1>
          {courseName && <p className="text-xs text-muted-foreground">{courseName}</p>}
        </div>
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
