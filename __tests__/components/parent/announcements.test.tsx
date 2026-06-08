import { render, screen } from '@testing-library/react'
import { AnnouncementCard } from '@/components/parent/AnnouncementCard'
import {
  toAnnouncements,
  formatAnnouncementDate,
  type RawBroadcastMessage,
} from '@/components/parent/announcementUtils'

function row(overrides: Partial<RawBroadcastMessage> = {}): RawBroadcastMessage {
  return {
    id: 'm1',
    content: 'Training moved to 6pm',
    created_at: '2026-01-10T09:00:00.000Z',
    room_name: 'U16 Squad',
    sender_name: 'Coach Smith',
    ...overrides,
  }
}

describe('toAnnouncements', () => {
  it('maps a broadcast message into an announcement', () => {
    const [a] = toAnnouncements([row()])
    expect(a).toEqual({
      id: 'm1',
      title: 'U16 Squad',
      body: 'Training moved to 6pm',
      createdAt: '2026-01-10T09:00:00.000Z',
      author: 'Coach Smith',
    })
  })

  it('orders announcements newest-first', () => {
    const result = toAnnouncements([
      row({ id: 'old', created_at: '2026-01-01T09:00:00.000Z' }),
      row({ id: 'new', created_at: '2026-03-01T09:00:00.000Z' }),
      row({ id: 'mid', created_at: '2026-02-01T09:00:00.000Z' }),
    ])
    expect(result.map(a => a.id)).toEqual(['new', 'mid', 'old'])
  })

  it('skips messages with empty or whitespace-only content', () => {
    const result = toAnnouncements([
      row({ id: 'empty', content: '' }),
      row({ id: 'spaces', content: '   ' }),
      row({ id: 'nullbody', content: null }),
      row({ id: 'keep', content: 'Real message' }),
    ])
    expect(result.map(a => a.id)).toEqual(['keep'])
  })

  it('falls back to default title and author when missing', () => {
    const [a] = toAnnouncements([row({ room_name: null, sender_name: null })])
    expect(a.title).toBe('Academy Announcement')
    expect(a.author).toBe('Academy')
  })

  it('trims the body content', () => {
    const [a] = toAnnouncements([row({ content: '  hello  ' })])
    expect(a.body).toBe('hello')
  })

  it('returns an empty array for no rows', () => {
    expect(toAnnouncements([])).toEqual([])
  })
})

describe('formatAnnouncementDate', () => {
  it('formats a valid ISO date with a separator', () => {
    const formatted = formatAnnouncementDate('2026-01-10T09:00:00.000Z')
    expect(formatted).toContain('·')
    expect(formatted).toMatch(/2026/)
  })

  it('returns an empty string for an invalid date', () => {
    expect(formatAnnouncementDate('not-a-date')).toBe('')
  })
})

describe('AnnouncementCard', () => {
  const announcement = {
    id: 'm1',
    title: 'U16 Squad',
    body: 'Training moved to 6pm',
    createdAt: '2026-01-10T09:00:00.000Z',
    author: 'Coach Smith',
  }

  it('renders the title, body and author', () => {
    render(<AnnouncementCard announcement={announcement} />)
    expect(screen.getByText('U16 Squad')).toBeInTheDocument()
    expect(screen.getByText('Training moved to 6pm')).toBeInTheDocument()
    expect(screen.getByText('Coach Smith')).toBeInTheDocument()
  })

  it('exposes the timestamp via a dateTime attribute', () => {
    const { container } = render(<AnnouncementCard announcement={announcement} />)
    const time = container.querySelector('time')
    expect(time).toHaveAttribute('dateTime', '2026-01-10T09:00:00.000Z')
  })
})
