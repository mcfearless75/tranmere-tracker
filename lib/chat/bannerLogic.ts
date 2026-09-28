import type { UnreadLatest } from '@/lib/chat/unread'

const ROOM_PATH = /^\/chat\/([0-9a-f-]{36})(?:\/|$)/i

/** The chat room currently on screen, from the pathname, or null. */
export function viewingRoomFrom(pathname: string | null): string | null {
  return pathname?.match(ROOM_PATH)?.[1] ?? null
}

/**
 * Whether a freshly fetched unread summary should pop the banner. Only a
 * realtime arrival does: unread messages already waiting when the app opens
 * are for the badge, not a pop-up.
 */
export function shouldShowBanner({ latest, fromArrival, lastShownId, viewingRoomId, suppressed }: {
  latest: UnreadLatest | null
  fromArrival: boolean
  lastShownId: string | null
  viewingRoomId: string | null
  suppressed: boolean
}): boolean {
  if (!latest || !fromArrival || suppressed) return false
  if (latest.id === lastShownId) return false
  return latest.roomId !== viewingRoomId
}

/** Badge text: nothing at 0, capped so it never outgrows the icon. */
export function badgeLabel(total: number): string | null {
  if (total <= 0) return null
  return total > 99 ? '99+' : String(total)
}

/** The chat list pages (staff/student and parent), which reorder on a new message. */
export function isChatListPath(pathname: string | null): boolean {
  return pathname === '/chat' || pathname === '/parent/messages'
}
