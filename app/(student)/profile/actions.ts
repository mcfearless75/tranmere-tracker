'use server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

export async function updateCourse(courseId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  await supabase.from('users').update({ course_id: courseId }).eq('id', user.id)
  revalidatePath('/profile')
}

export async function uploadAvatar(formData: FormData) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const file = formData.get('avatar') as File
  if (!file || file.size === 0) return { error: 'No file' }

  const adminClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Create bucket if it doesn't exist
  await adminClient.storage.createBucket('avatars', { public: true }).catch(() => {})

  const ext = file.name.split('.').pop()
  const path = `${user.id}.${ext}`
  const bytes = await file.arrayBuffer()

  const { error: uploadError } = await adminClient.storage
    .from('avatars')
    .upload(path, bytes, { contentType: file.type, upsert: true })

  if (uploadError) return { error: uploadError.message }

  const { data: { publicUrl } } = adminClient.storage.from('avatars').getPublicUrl(path)
  await adminClient.from('users').update({ avatar_url: publicUrl }).eq('id', user.id)
  revalidatePath('/profile')
  return { url: publicUrl }
}
