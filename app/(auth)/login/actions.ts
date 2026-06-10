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
  await supabase.auth.signOut()
  redirect('/login')
}
