'use server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function updateCourse(courseId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  // Use service client to bypass RLS — user can always update their own course
  const admin = serviceClient()
  const { error } = await admin
    .from('users')
    .update({ course_id: courseId || null })
    .eq('id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/profile')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function uploadAvatar(formData: FormData) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const file = formData.get('avatar') as File
  if (!file || file.size === 0) return { error: 'No file' }

  const adminClient = serviceClient()

  await adminClient.storage.createBucket('avatars', { public: true }).catch(() => {})

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const path = `${user.id}-${Date.now()}.${ext}`
  const bytes = await file.arrayBuffer()

  const { error: uploadError } = await adminClient.storage
    .from('avatars')
    .upload(path, bytes, { contentType: file.type || 'image/jpeg', upsert: true })

  if (uploadError) return { error: uploadError.message }

  const { data: { publicUrl } } = adminClient.storage.from('avatars').getPublicUrl(path)
  await adminClient.from('users').update({ avatar_url: publicUrl }).eq('id', user.id)
  revalidatePath('/profile')
  revalidatePath('/dashboard')
  return { url: publicUrl }
}
