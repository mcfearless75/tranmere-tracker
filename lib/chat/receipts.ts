/**
 * Read receipts. "Read" means the member's chat_members.last_read_at is at or
 * after the message's created_at — markRead bumps it when a room is opened
 * and whenever a message arrives while the room is on screen. No per-message
 * read table: one timestamp per member is enough and costs nothing extra.
 *
 * Who sees what (decided 2026-09-29):
 *  - DMs: both people see ✓ / ✓✓ on their own messages.
 *  - Group rooms: staff only, on their own messages ("Seen by 7/15").
 *    Players never see group read counts — avoids social pressure in a
 *    youth setting. The server doesn't even send them the timestamps.
 *  - AI Coach room: none.
 */

export type ReceiptMode = 'dm' | 'group' | 'none'

export function receiptMode(roomKind: string, isStaff: boolean): ReceiptMode {
  if (roomKind === 'bot') return 'none'
  if (roomKind === 'dm') return 'dm'
  return isStaff ? 'group' : 'none'
}

/** userId -> last_read_at ISO string. */
export type LastReadMap = Record<string, string>

export function hasRead(lastReadAt: string | null | undefined, messageCreatedAt: string): boolean {
  if (!lastReadAt) return false
  return Date.parse(lastReadAt) >= Date.parse(messageCreatedAt)
}

/** Keep the later of two timestamps — receipts only ever move forward. */
export function advanceLastRead(map: LastReadMap, userId: string, at: string): LastReadMap {
  const current = map[userId]
  if (current && Date.parse(current) >= Date.parse(at)) return map
  return { ...map, [userId]: at }
}

export type ReceiptSummary = {
  readBy: string[]
  unreadBy: string[]
}

/** Who has / hasn't read a message, excluding its sender and any excluded ids (e.g. the AI bot). */
export function summariseReceipt(
  messageCreatedAt: string,
  senderId: string,
  memberIds: string[],
  lastRead: LastReadMap,
  exclude: string[] = [],
): ReceiptSummary {
  const readBy: string[] = []
  const unreadBy: string[] = []
  for (const id of memberIds) {
    if (id === senderId || exclude.includes(id)) continue
    if (hasRead(lastRead[id], messageCreatedAt)) readBy.push(id)
    else unreadBy.push(id)
  }
  return { readBy, unreadBy }
}
