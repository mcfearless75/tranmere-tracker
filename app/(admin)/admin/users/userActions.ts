'use server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

function adminClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function updateUserRole(userId: string, role: string) {
  const client = adminClient()
  await client.from('users').update({ role }).eq('id', userId)
  revalidatePath('/admin/users')
}

export async function updateUserCourse(userId: string, courseId: string) {
  const client = adminClient()
  await client.from('users').update({ course_id: courseId || null }).eq('id', userId)
  revalidatePath('/admin/users')
}
