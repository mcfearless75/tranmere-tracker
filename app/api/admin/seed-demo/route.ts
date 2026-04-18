import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Seeds realistic demo data for showing the Head of Academy
// - 10 student accounts
// - 8 GPS sessions per player with varied metrics
// - 2 match events with squad selections + ratings
// - 3 assignments with submissions

const PLAYERS = [
  'Jack Harrison', 'Leo Turner', 'Marcus O\'Sullivan', 'Callum Wright',
  'Ethan Reid', 'Dylan Matthews', 'Tommy Callaghan', 'Sam Briggs',
  'Riley Owens', 'Finley Carter',
]

// Gaussian random roughly centered on a mean
function rand(mean: number, variance: number) {
  const u1 = Math.random(), u2 = Math.random()
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  return Math.max(0, mean + z * variance)
}

function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10)
}

export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const adminClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: courses } = await adminClient.from('courses').select('id').limit(1)
  const courseId = courses?.[0]?.id

  // Get any existing btec_unit for assignment seeding
  const { data: units } = await adminClient.from('btec_units').select('id').limit(1)
  let unitId = units?.[0]?.id
  if (!unitId && courseId) {
    const { data: newUnit } = await adminClient.from('btec_units').insert({
      course_id: courseId,
      unit_number: 'U01',
      unit_name: 'Fitness for Sport and Exercise',
    }).select('id').single()
    unitId = newUnit?.id
  }

  // Create player accounts (skip existing ones)
  const createdPlayers: { id: string; name: string }[] = []
  for (let i = 0; i < PLAYERS.length; i++) {
    const name = PLAYERS[i]
    const username = name.toLowerCase().replace(/[^a-z]/g, '')
    const email = `${username}@tranmeretracker.internal`

    // Check if already exists
    const { data: existing } = await adminClient.auth.admin.listUsers()
    const found = existing?.users?.find(u => u.email === email)
    let id: string | undefined = found?.id
    if (!id) {
      const { data: created } = await adminClient.auth.admin.createUser({
        email, password: `1234${i}5`, email_confirm: true, user_metadata: { full_name: name },
      })
      id = created?.user?.id
      if (id) {
        await adminClient.from('users').upsert({ id, email, name, role: 'student', course_id: courseId ?? null })
      }
    }
    if (id) createdPlayers.push({ id, name })
  }

  // GPS sessions (8 sessions per player across last 28 days)
  const gpsRows: any[] = []
  for (const p of createdPlayers) {
    // Each player has a "baseline ability" that shapes their averages
    const ability = 0.85 + Math.random() * 0.3  // 0.85 - 1.15 multiplier

    for (let s = 0; s < 8; s++) {
      const daysBack = 28 - s * 3 - Math.floor(Math.random() * 2)
      const isMatch = s % 3 === 0
      const baseDist = isMatch ? 9500 : 6500
      const duration = isMatch ? 90 : 75
      const totalDist = rand(baseDist * ability, 600)
      const topSpeed = rand(30 * ability, 1.5)
      const sprints = Math.round(rand(isMatch ? 22 : 14, 4) * ability)
      const accel = Math.round(rand(isMatch ? 45 : 35, 6))
      const decel = Math.round(rand(isMatch ? 43 : 33, 6))
      const load = rand(isMatch ? 480 : 320, 40) * ability

      // Speed zone breakdown (sums to totalDist)
      const z5 = rand(sprints * 18, 20)
      const z4 = rand(totalDist * 0.12, 50)
      const z3 = rand(totalDist * 0.25, 80)
      const z2 = rand(totalDist * 0.35, 100)
      const z1 = Math.max(0, totalDist - z2 - z3 - z4 - z5)

      gpsRows.push({
        player_id: p.id,
        session_date: daysAgo(daysBack),
        session_label: isMatch ? `vs ${['Everton U18','Liverpool U18','Wrexham Academy'][s % 3]}` : 'Training',
        source: 'statsports',
        total_distance_m: +totalDist.toFixed(1),
        hsr_distance_m: +(z4 + z5).toFixed(1),
        sprint_distance_m: +z5.toFixed(1),
        max_speed_kmh: +topSpeed.toFixed(1),
        max_speed_ms: +(topSpeed / 3.6).toFixed(2),
        sprint_count: sprints,
        accel_count: accel,
        decel_count: decel,
        player_load: +load.toFixed(2),
        duration_mins: duration,
        zone1_m: +z1.toFixed(1),
        zone2_m: +z2.toFixed(1),
        zone3_m: +z3.toFixed(1),
        zone4_m: +z4.toFixed(1),
        zone5_m: +z5.toFixed(1),
        imported_by: user.id,
      })
    }
  }

  // Wipe & re-seed this coach's GPS sessions to keep demo fresh
  await adminClient.from('gps_sessions').delete().eq('imported_by', user.id)
  if (gpsRows.length) await adminClient.from('gps_sessions').insert(gpsRows)

  // Match events
  const { data: matchRows } = await adminClient.from('match_events').insert([
    { coach_id: user.id, match_date: daysAgo(3),  opponent: 'Everton U18',    location: 'Prenton Park', status: 'completed' },
    { coach_id: user.id, match_date: daysAgo(-7), opponent: 'Wrexham U18',    location: 'Away',          status: 'upcoming'  },
  ]).select('id, status')

  if (matchRows) {
    const completed = matchRows.find(m => m.status === 'completed')
    const upcoming = matchRows.find(m => m.status === 'upcoming')

    if (completed) {
      const squad = createdPlayers.slice(0, 8).map((p, i) => ({
        match_id: completed.id,
        player_id: p.id,
        status: i < 6 ? 'accepted' : 'declined',
        position: ['GK','RB','CB','LB','CM','CAM','LW','ST'][i],
        coach_rating: i < 6 ? Math.round(rand(7, 1)) : null,
      }))
      await adminClient.from('match_squads').insert(squad)
    }
    if (upcoming) {
      const squad = createdPlayers.slice(0, 9).map((p, i) => ({
        match_id: upcoming.id,
        player_id: p.id,
        status: i < 5 ? 'accepted' : 'invited',
      }))
      await adminClient.from('match_squads').insert(squad)
    }
  }

  // Assignments + submissions
  if (unitId) {
    const { data: ass } = await adminClient.from('assignments').insert([
      { unit_id: unitId, title: 'Components of Fitness Report', description: 'Analyse the components of physical fitness', due_date: daysAgo(-7), grade_target: 'Merit' },
      { unit_id: unitId, title: 'Training Methods Presentation', description: 'Present 3 training methods for elite football', due_date: daysAgo(-14), grade_target: 'Distinction' },
      { unit_id: unitId, title: 'Nutrition for Performance', description: 'Design a 7-day meal plan for match week', due_date: daysAgo(-21), grade_target: 'Pass' },
    ]).select('id')

    if (ass) {
      const subs: any[] = []
      for (const a of ass) {
        for (let i = 0; i < createdPlayers.length; i++) {
          const p = createdPlayers[i]
          const statuses = ['not_started', 'in_progress', 'submitted', 'graded']
          const status = statuses[i % 4]
          subs.push({
            assignment_id: a.id,
            student_id: p.id,
            status,
            grade: status === 'graded' ? ['Pass','Merit','Distinction'][i % 3] : null,
            feedback: status === 'graded' ? 'Good analysis. Expand the evaluation section for a higher grade.' : null,
          })
        }
      }
      await adminClient.from('submissions').upsert(subs, { onConflict: 'assignment_id,student_id' })
    }
  }

  return NextResponse.json({
    success: true,
    message: `Seeded ${createdPlayers.length} players · ${gpsRows.length} GPS sessions · 2 matches · 3 assignments`,
    players: createdPlayers.map(p => p.name),
  })
}
