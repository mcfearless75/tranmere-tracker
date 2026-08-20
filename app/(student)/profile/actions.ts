'use server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { isHeicFile } from '@/lib/media/heic'

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

// The browser (and the client-side conversion in ProfileClient) should never
// send anything outside this list — HEIC/HEIF (the default iPhone camera
// format) does not render in an <img> tag on almost any non-Apple browser,
// so it must never reach storage. This is a server-side backstop in case a
// stale client build skips the client-side conversion.
const ALLOWED_AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

export async function uploadAvatar(formData: FormData) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const file = formData.get('avatar') as File
  if (!file || file.size === 0) return { error: 'No file' }

  if (isHeicFile(file)) {
    return { error: 'That photo format (HEIC) can\'t be used here — please try again, the app should convert it automatically.' }
  }
  if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
    return { error: 'Please upload a JPEG, PNG, WEBP or GIF image.' }
  }

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
