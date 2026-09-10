'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function signIn(_prevState: { error: string } | null, formData: FormData) {
  const supabase = createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })
  if (error) return { error: error.message }
  const next = formData.get('next') as string | null
  // Reject '//evil.com' (protocol-relative) as well as absolute URLs.
  redirect(next && next.startsWith('/') && !next.startsWith('//') ? next : '/')
}

export async function signOut() {
  const supabase = createClient()
  // scope:'local' — only end THIS browser's session. The default ('global')
  // revokes every refresh token the user holds, and students routinely hold
  // two or three: the native app's WebView, Safari/Chrome opened from the QR
  // sticker on tranmeretracker.vercel.app, and app.thesolarcampus.com. A
  // sign-out on one was killing the others, which then failed with "Refresh
  // Token Not Found" up to an hour later (88 such errors in the week to
  // 2026-09-10) — experienced as a random logout on a different device.
  await supabase.auth.signOut({ scope: 'local' })
  redirect('/login')
}
