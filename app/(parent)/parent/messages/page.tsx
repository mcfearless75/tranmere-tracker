import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { MessageSquare } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function ParentMessagesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: memberships } = await admin
    .from('chat_members')
    .select('room_id, chat_rooms(id, kind, name, last_message_at)')
    .eq('user_id', user.id)

  const rooms = (memberships ?? [])
    .map((m: any) => m.chat_rooms)
    .filter((r: any) => r && ['parent', 'dm'].includes(r.kind))

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-tranmere-blue">Messages</h1>
      <p className="text-sm text-muted-foreground">Academy Parents group and private messages with staff.</p>
      {rooms.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No chats yet. Staff will invite you into the Parents group.</p>
      ) : (
        <div className="bg-white rounded-xl border divide-y">
          {rooms.map((r: any) => (
            <Link key={r.id} href={`/chat/${r.id}`} className="flex items-center gap-3 p-4">
              <MessageSquare size={18} className="text-tranmere-blue" />
              <div>
                <p className="font-semibold text-sm">{r.kind === 'parent' ? (r.name ?? 'Parents') : (r.name ?? 'Private message')}</p>
                <p className="text-xs text-muted-foreground">{r.kind === 'parent' ? 'Whole parent group' : 'With academy staff'}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
