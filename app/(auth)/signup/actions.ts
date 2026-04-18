'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function signUp(
  _prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const name = (formData.get('name') as string)?.trim()
  const email = (formData.get('email') as string)?.trim()
  const password = formData.get('password') as string
  const confirm = formData.get('confirm') as string
  const honeypot = formData.get('website') as string
  const mathAnswer = (formData.get('math_answer') as string)?.trim()
  const mathExpected = formData.get('math_expected') as string

  // Honeypot — bots fill this field
  if (honeypot) return { error: 'Submission rejected.' }

  // Math CAPTCHA
  if (mathAnswer !== mathExpected) return { error: 'Human check failed — please try again.' }

  if (!name) return { error: 'Full name is required.' }
  if (password !== confirm) return { error: 'Passwords do not match.' }
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' }

  const supabase = createClient()

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: name },
    },
  })

  if (error) return { error: error.message }

  redirect('/dashboard')
}
