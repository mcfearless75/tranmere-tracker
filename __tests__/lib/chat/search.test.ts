import { searchRooms, searchNewPeople, normalise } from '@/lib/chat/search'

const rooms = [
  { id: 'dm-l', kind: 'dm', label: 'Lewis White', otherUserId: 'lewis', memberNames: [] },
  { id: 'prem', kind: 'custom', label: 'Prem Squad', otherUserId: null, memberNames: ['Lewis White', 'Chaid Jones'] },
  { id: 'blue', kind: 'squad', label: 'Blue', otherUserId: null, memberNames: ['Javan Moussa'] },
]

describe('searchRooms', () => {
  it('returns everything for an empty query', () => {
    expect(searchRooms(rooms, '  ')).toHaveLength(3)
  })
  it('matches titles case-insensitively', () => {
    expect(searchRooms(rooms, 'prem').map(r => r.room.id)).toEqual(['prem'])
  })
  it('finds a lad\'s DM and the groups he is in', () => {
    const res = searchRooms(rooms, 'lewis')
    expect(res.map(r => r.room.id)).toEqual(['dm-l', 'prem'])
    expect(res[0].viaMember).toBeNull()
    expect(res[1].viaMember).toBe('Lewis White')
  })
  it('requires every term to match', () => {
    expect(searchRooms(rooms, 'javan m').map(r => r.room.id)).toEqual(['blue'])
    expect(searchRooms(rooms, 'javan white')).toHaveLength(0)
  })
  it('ignores accents', () => {
    expect(normalise('Zoë')).toBe('zoe')
  })
})

describe('searchNewPeople', () => {
  const people = [
    { id: 'lewis', name: 'Lewis White' },
    { id: 'lewis2', name: 'Lewis Brown' },
    { id: 'x', name: null },
  ]
  it('skips people you already have a DM with', () => {
    expect(searchNewPeople(people, rooms, 'lewis').map(p => p.id)).toEqual(['lewis2'])
  })
  it('returns nothing for an empty query', () => {
    expect(searchNewPeople(people, rooms, '')).toEqual([])
  })
})
