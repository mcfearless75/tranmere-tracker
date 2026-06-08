// Pure helpers for the parent announcements feed.
// Announcements are sourced from existing broadcast chat rooms/messages —
// there is no dedicated announcements table.

export interface RawBroadcastMessage {
  id: string
  content: string | null
  created_at: string
  room_name: string | null
  sender_name: string | null
}

export interface Announcement {
  id: string
  title: string
  body: string
  createdAt: string
  author: string
}

const DEFAULT_TITLE = 'Academy Announcement'
const DEFAULT_AUTHOR = 'Academy'

/**
 * Maps raw broadcast messages into announcement items, newest-first.
 * Skips messages with no usable body. The broadcast room name becomes the
 * announcement title so parents see what channel it came from.
 */
export function toAnnouncements(rows: ReadonlyArray<RawBroadcastMessage>): Announcement[] {
  return rows
    .filter(row => (row.content ?? '').trim().length > 0)
    .map(row => ({
      id: row.id,
      title: (row.room_name ?? '').trim() || DEFAULT_TITLE,
      body: (row.content ?? '').trim(),
      createdAt: row.created_at,
      author: (row.sender_name ?? '').trim() || DEFAULT_AUTHOR,
    }))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
}

/**
 * Formats an ISO timestamp as a London-time date + time string for display.
 */
export function formatAnnouncementDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const datePart = date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  const timePart = date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/London',
  })
  return `${datePart} · ${timePart}`
}
