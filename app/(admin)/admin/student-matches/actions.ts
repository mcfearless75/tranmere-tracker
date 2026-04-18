'use server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

export async function logStudentMatch(data: {
  student_id: string
  match_date: string
  opponent: string
  goals: string
  assists: string
  minutes_played: string
  rating: string
  position: string
  notes: string
}) {
  const client = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  await client.from('match_logs').insert({
    student_id: data.student_id,
    match_date: data.match_date,
    opponent: data.opponent,
    goals: Number(data.goals),
    assists: Number(data.assists),
    minutes_played: Number(data.minutes_played),
    rating: Number(data.rating),
    position: data.position || null,
    notes: data.notes || null,
  })
  revalidatePath('/admin/student-matches')
}
