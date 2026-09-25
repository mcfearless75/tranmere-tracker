import { summarisePushCoverage } from '@/lib/notifications/pushCoverage'

const users = [
  { id: 's1', name: 'Zak', role: 'student' },
  { id: 's2', name: 'Adam', role: 'student' },
  { id: 's3', name: 'Ben', role: 'student' },
  { id: 'c1', name: 'Coach Carl', role: 'coach' },
  { id: 'b1', name: 'Bot', role: 'bot' },
]

describe('summarisePushCoverage', () => {
  it('counts a user as reachable via either web push or a native token', () => {
    const r = summarisePushCoverage(users, ['s1'], ['s2'])
    expect(r.total).toBe(4)
    expect(r.reachable).toBe(2)
    expect(r.unreachable.map(u => u.id)).toEqual(['c1', 's3'])
  })

  it('ignores non-human roles like bot', () => {
    const r = summarisePushCoverage(users, [], [])
    expect(r.unreachable.find(u => u.role === 'bot')).toBeUndefined()
  })

  it('does not double-count users with several devices', () => {
    const r = summarisePushCoverage(users, ['s1', 's1'], ['s1', 's2', 's3', 'c1'])
    expect(r.reachable).toBe(4)
    expect(r.unreachable).toEqual([])
  })

  it('sorts unreachable by role then name so staff can scan it', () => {
    const r = summarisePushCoverage(users, [], [])
    expect(r.unreachable.map(u => u.name)).toEqual(['Coach Carl', 'Adam', 'Ben', 'Zak'])
  })
})
