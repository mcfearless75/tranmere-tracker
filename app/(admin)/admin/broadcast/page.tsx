import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Megaphone, Users, MessageSquare } from 'lucide-react'
import { CreateBroadcastForm } from './CreateBroadcastForm'

export const dynamic = 'force-dynamic'

export default async function BroadcastPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'coach', 'teacher'].includes(profile.role)) redirect('/dashboard')

  const { data: rooms } = await admin
    .from('chat_rooms')
    .select('id, name, last_message_at, created_at')
    .eq('kind', 'broadcast')
    .order('created_at', { ascending: false })

  const roomIds = (rooms ?? []).map(r => r.id)
  const { data: memberCounts } = roomIds.length
    ? await admin.from('chat_members').select('room_id').in('room_id', roomIds)
    : { data: [] }

  const countByRoom: Record<string, number> = {}
  for (const m of memberCounts ?? []) {
    countByRoom[m.room_id] = (countByRoom[m.room_id] ?? 0) + 1
  }

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div className="flex items-center gap-2">
        <Megaphone size={22} className="text-tranmere-blue" />
        <h1 className="text-xl font-bold text-tranmere-blue">Broadcast Channels</h1>
      </div>

      <div className="rounded-2xl border bg-white p-5 space-y-3">
        <p className="text-sm font-semibold text-gray-700">New broadcast channel</p>
        <p className="text-xs text-muted-foreground">All squad members are added automatically. Only staff can post.</p>
        <CreateBroadcastForm />
      </div>

      <div className="space-y-2">
        {(rooms ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">No broadcast channels yet.</p>
        )}
        {(rooms ?? []).map(r => (
          <Link
            key={r.id}
            href={`/chat/${r.id}`}
            className="flex items-center gap-3 p-4 rounded-2xl border bg-white hover:bg-gray-50 transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-tranmere-blue to-blue-900 flex items-center justify-center shrink-0">
              <Megaphone size={18} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{r.name}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Users size={11} /> {countByRoom[r.id] ?? 0} members
              </p>
            </div>
            <MessageSquare size={16} className="text-gray-400 shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  )
}
