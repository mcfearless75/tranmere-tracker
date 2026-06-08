import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { Megaphone } from 'lucide-react'
import { AnnouncementCard } from '@/components/parent/AnnouncementCard'
import { toAnnouncements, type RawBroadcastMessage } from '@/components/parent/announcementUtils'

export const dynamic = 'force-dynamic'

const MAX_ROOMS = 25
const MAX_MESSAGES = 50

export default async function ParentAnnouncementsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  // Announcements reuse the existing broadcast channels — no dedicated table.
  const { data: broadcastRooms } = await admin
    .from('chat_rooms')
    .select('id, name')
    .eq('kind', 'broadcast')
    .order('created_at', { ascending: false })
    .limit(MAX_ROOMS)

  const roomNameById = new Map<string, string | null>()
  for (const room of broadcastRooms ?? []) {
    roomNameById.set(room.id as string, (room.name as string | null) ?? null)
  }

  const roomIds = Array.from(roomNameById.keys())

  let rawRows: RawBroadcastMessage[] = []

  if (roomIds.length > 0) {
    const { data: rawMessages } = await admin
      .from('chat_messages')
      .select('id, content, created_at, room_id, users(name)')
      .in('room_id', roomIds)
      .order('created_at', { ascending: false })
      .limit(MAX_MESSAGES)

    rawRows = (rawMessages ?? []).map(m => {
      const sender = Array.isArray(m.users)
        ? (m.users[0] as { name: string | null } | undefined)
        : (m.users as { name: string | null } | null)
      return {
        id: m.id as string,
        content: m.content as string | null,
        created_at: m.created_at as string,
        room_name: roomNameById.get(m.room_id as string) ?? null,
        sender_name: sender?.name ?? null,
      }
    })
  }

  const announcements = toAnnouncements(rawRows)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-tranmere-blue">Announcements</h1>
        <p className="text-sm text-gray-500 mt-1">Latest academy announcements, newest first.</p>
      </div>

      {announcements.length > 0 ? (
        <div className="space-y-3">
          {announcements.map(announcement => (
            <AnnouncementCard key={announcement.id} announcement={announcement} />
          ))}
        </div>
      ) : (
        <div className="bg-white border rounded-xl p-8 text-center">
          <Megaphone size={32} className="mx-auto text-gray-200 mb-3" />
          <p className="text-gray-500 font-medium">No announcements yet</p>
          <p className="text-sm text-gray-400 mt-1">Academy announcements will appear here.</p>
        </div>
      )}
    </div>
  )
}
