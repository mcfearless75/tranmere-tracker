'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type SavePlayerAttributesPayload = {
  userId?:        string  // optional — if omitted, save for current user
  date_of_birth?: string | null
  position?:      string | null
  height_cm?:     number | null
  weight_kg?:     number | null
  build?:         string | null
  dominant_foot?: string | null
}

export async function savePlayerAttributes(payload: SavePlayerAttributesPayload) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Unauthorised' }

  // Decide whose row to update
  let targetId = user.id
  if (payload.userId && payload.userId !== user.id) {
    const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
    if (!profile || !['admin', 'coach', 'teacher'].includes(profile.role)) {
      return { ok: false, error: 'Forbidden' }
    }
    targetId = payload.userId
  }

  const update: Record<string, unknown> = {}
  if ('date_of_birth' in payload) update.date_of_birth = payload.date_of_birth || null
  if ('position'      in payload) update.position      = payload.position      || null
  if ('height_cm'     in payload) update.height_cm     = payload.height_cm     ?? null
  if ('weight_kg'     in payload) update.weight_kg     = payload.weight_kg     ?? null
  if ('build'         in payload) update.build         = payload.build         || null
  if ('dominant_foot' in payload) update.dominant_foot = payload.dominant_foot || null

  const { error } = await supabase.from('users').update(update).eq('id', targetId)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/profile')
  revalidatePath(`/admin/students/${targetId}`)
  return { ok: true }
}
