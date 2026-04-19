import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Canonical BTEC unit lists for the three courses used at Tranmere Rovers Academy.
// Sourced from Pearson BTEC specifications (Level 2 First Award in Sport,
// Level 3 National in Sport - Coaching & Development pathway,
// Level 3 National in Sport and Exercise Science).

const BTEC_UNITS = {
  'Level 2 Public Services / Fitness': [
    { number: 'U01', name: 'Fitness for Sport and Exercise' },
    { number: 'U02', name: 'Practical Sports Performance' },
    { number: 'U03', name: 'Applying the Principles of Personal Training' },
    { number: 'U04', name: 'The Mind and Sports Performance' },
    { number: 'U05', name: 'The Sports Performer in Action' },
    { number: 'U06', name: 'Leading Sports Activities' },
    { number: 'U07', name: 'Anatomy and Physiology for Sports Performance' },
    { number: 'U08', name: 'Promotion and Sponsorship in Sport' },
    { number: 'U09', name: 'Lifestyle and Well-being' },
    { number: 'U10', name: 'Injury and the Sports Performer' },
    { number: 'U11', name: 'Running a Sports Event' },
    { number: 'U12', name: 'Outdoor and Adventurous Activities' },
    { number: 'U13', name: 'Profiling Sports Performance' },
  ],

  'Level 3 Sports Coaching': [
    { number: 'U01', name: 'Anatomy and Physiology' },
    { number: 'U02', name: 'Fitness Training and Programming for Health, Sport and Well-being' },
    { number: 'U03', name: 'Professional Development in the Sports Industry' },
    { number: 'U04', name: 'Sports Leadership' },
    { number: 'U05', name: 'Application of Fitness Testing' },
    { number: 'U06', name: 'Sports Psychology' },
    { number: 'U07', name: 'Practical Sports Performance' },
    { number: 'U08', name: 'Coaching for Performance' },
    { number: 'U09', name: 'Research Methods in Sport' },
    { number: 'U10', name: 'Sports Event Organisation' },
    { number: 'U11', name: 'Research Project in Sport' },
    { number: 'U12', name: 'Self-Employment in the Sports Industry' },
    { number: 'U13', name: 'Nutrition for Sport and Exercise Performance' },
    { number: 'U14', name: 'Sports Injury Management' },
    { number: 'U15', name: 'Careers in Sport and the Active Leisure Industry' },
  ],

  'Level 3 Sports Science': [
    { number: 'U01', name: 'Sport and Exercise Physiology' },
    { number: 'U02', name: 'Functional Anatomy' },
    { number: 'U03', name: 'Applied Sport and Exercise Psychology' },
    { number: 'U04', name: 'Field and Laboratory-based Fitness Testing' },
    { number: 'U05', name: 'Applied Research Methods for Sport and Exercise Science' },
    { number: 'U06', name: 'Coaching for Performance' },
    { number: 'U07', name: 'Biomechanics in Sport and Exercise Science' },
    { number: 'U08', name: 'Specialised Fitness Training' },
    { number: 'U09', name: 'Research Project in Sport and Exercise Science' },
    { number: 'U10', name: 'Nutrition for Sport and Exercise Performance' },
    { number: 'U11', name: 'Sports Massage' },
    { number: 'U12', name: 'Technology in Sport and Exercise Science' },
    { number: 'U13', name: 'Sociocultural Issues in Sport and Exercise' },
    { number: 'U14', name: 'Sports Injury Assessment and Rehabilitation' },
    { number: 'U15', name: 'Work Experience in Sport and Exercise Science' },
  ],
}

export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  // Map course names to ids
  const { data: courses } = await admin.from('courses').select('id, name')
  if (!courses) return NextResponse.json({ error: 'No courses found' }, { status: 500 })

  const byName: Record<string, string> = {}
  for (const c of courses) byName[c.name] = c.id

  let inserted = 0
  let skipped = 0

  for (const [courseName, units] of Object.entries(BTEC_UNITS)) {
    const courseId = byName[courseName]
    if (!courseId) {
      // Try fuzzy match (course might be named slightly differently)
      const match = courses.find(c => c.name.toLowerCase().includes(courseName.toLowerCase().split(' ').pop() ?? ''))
      if (!match) continue
    }
    const cid = byName[courseName] ?? courses.find(c => c.name.toLowerCase().includes(courseName.toLowerCase().split(' ')[1]))?.id
    if (!cid) continue

    for (const u of units) {
      // Skip if already exists (unique on course_id + unit_number)
      const { data: existing } = await admin
        .from('btec_units')
        .select('id')
        .eq('course_id', cid)
        .eq('unit_number', u.number)
        .maybeSingle()

      if (existing) { skipped++; continue }

      await admin.from('btec_units').insert({
        course_id: cid,
        unit_number: u.number,
        unit_name: u.name,
      })
      inserted++
    }
  }

  return NextResponse.json({
    success: true,
    message: `Inserted ${inserted} unit(s), skipped ${skipped} existing.`,
  })
}
