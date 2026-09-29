/**
 * Chat list search (requested by coaches 2026-09-29: "search up a lad's
 * name"). Matches a conversation's title, or — for group rooms — any member's
 * name, so typing "Lewis" surfaces his DM *and* the squad chats he's in.
 * People with no existing DM are returned separately so the list can offer
 * "start a chat".
 */

export type SearchableRoom = {
  id: string
  kind: string
  label: string
  otherUserId: string | null
  memberNames: string[]
}

export type SearchablePerson = { id: string; name: string | null }

export function normalise(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

/** Every whitespace-separated term must appear somewhere in the text. */
function matches(text: string, terms: string[]): boolean {
  const t = normalise(text)
  return terms.every(term => t.includes(term))
}

export type RoomMatch<R extends SearchableRoom> = { room: R; viaMember: string | null }

export function searchRooms<R extends SearchableRoom>(rooms: R[], query: string): RoomMatch<R>[] {
  const terms = normalise(query).split(/\s+/).filter(Boolean)
  if (!terms.length) return rooms.map(room => ({ room, viaMember: null }))
  const out: RoomMatch<R>[] = []
  for (const room of rooms) {
    if (matches(room.label, terms)) { out.push({ room, viaMember: null }); continue }
    if (room.kind === 'dm') continue
    const member = room.memberNames.find(n => matches(n, terms))
    if (member) out.push({ room, viaMember: member })
  }
  return out
}

/** People matching the query who you don't already have a DM with. */
export function searchNewPeople<P extends SearchablePerson>(
  people: P[],
  rooms: SearchableRoom[],
  query: string,
  limit = 5,
): P[] {
  const terms = normalise(query).split(/\s+/).filter(Boolean)
  if (!terms.length) return []
  const haveDm = new Set(rooms.filter(r => r.kind === 'dm' && r.otherUserId).map(r => r.otherUserId))
  return people.filter(p => !haveDm.has(p.id) && matches(p.name ?? '', terms)).slice(0, limit)
}
