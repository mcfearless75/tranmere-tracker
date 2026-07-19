'use server'
import { requireStaffAction } from '@/lib/auth/requireRole'
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
  const { admin: client } = await requireStaffAction()
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
