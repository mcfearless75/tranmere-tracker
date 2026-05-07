import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { Megaphone } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface BroadcastMessage {
  id: string
  content: string
  created_at: string
  sender: { name: string | null } | null
}

export default async function ParentMessagesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  // Fetch broadcast chat rooms and their latest messages
  const { data: broadcastRooms } = await admin
    .from('chat_rooms')
    .select('id, name')
    .eq('kind', 'broadcast')
    .order('created_at', { ascending: false })
    .limit(5)

  const roomIds = (broadcastRooms ?? []).map(r => r.id as string)

  let messages: BroadcastMessage[] = []

  if (roomIds.length > 0) {
    const { data: rawMessages } = await admin
      .from('chat_messages')
      .select('id, content, created_at, sender_id, users(name)')
      .in('room_id', roomIds)
      .order('created_at', { ascending: false })
      .limit(20)

    messages = (rawMessages ?? []).map(m => ({
      id: m.id as string,
      content: m.content as string,
      created_at: m.created_at as string,
      sender: (Array.isArray(m.users) ? m.users[0] as { name: string | null } : m.users as { name: string | null } | null) ?? null,
    }))
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-tranmere-blue">Messages</h1>
      <p className="text-sm text-gray-500">Academy broadcast messages — read only.</p>

      {messages.length > 0 ? (
        <div className="space-y-3">
          {messages.map(msg => (
            <div key={msg.id} className="bg-white border rounded-xl p-4 space-y-2">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-tranmere-blue/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Megaphone size={14} className="text-tranmere-blue" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-xs font-semibold text-gray-700">{msg.sender?.name ?? 'Academy'}</p>
                    <time className="text-xs text-gray-400 shrink-0">
                      {new Date(msg.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {' '}
                      {new Date(msg.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </time>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white border rounded-xl p-8 text-center">
          <Megaphone size={32} className="mx-auto text-gray-200 mb-3" />
          <p className="text-gray-500 font-medium">No messages yet</p>
          <p className="text-sm text-gray-400 mt-1">Academy broadcast messages will appear here.</p>
        </div>
      )}
    </div>
  )
}
