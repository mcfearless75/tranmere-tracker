/**
 * Tests for the recruitment admin pure helpers and the status badge render.
 * recruitmentUtils (owned by another work stream) is mocked so these tests
 * exercise only the recruitment admin components themselves.
 */
import { render, screen } from '@testing-library/react'
import { formatDate, formatDateTime } from '@/components/admin/recruitment/formatters'

jest.mock('@/lib/recruitment/recruitmentUtils', () => ({
  PROSPECT_STATUSES: ['new', 'reviewing', 'invited', 'trialled', 'offered', 'signed', 'rejected'],
  STATUS_META: {
    new: { label: 'New', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200' },
    reviewing: { label: 'Reviewing', badgeClass: 'bg-amber-50 text-amber-700 border-amber-200' },
    invited: { label: 'Invited', badgeClass: 'bg-purple-50 text-purple-700 border-purple-200' },
    trialled: { label: 'Trialled', badgeClass: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
    offered: { label: 'Offered', badgeClass: 'bg-green-50 text-green-700 border-green-200' },
    signed: { label: 'Signed', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    rejected: { label: 'Rejected', badgeClass: 'bg-red-50 text-red-700 border-red-200' },
  },
  prospectAge: jest.fn(() => 14),
}))

import { ProspectStatusBadge } from '@/components/admin/recruitment/ProspectStatusBadge'

describe('formatDate', () => {
  it('formats an ISO date in en-GB style', () => {
    expect(formatDate('2026-06-01')).toBe('1 Jun 2026')
  })

  it('returns a fallback for an invalid date', () => {
    expect(formatDate('not-a-date')).toBe('Unknown date')
  })
})

describe('formatDateTime', () => {
  it('includes the time component', () => {
    const result = formatDateTime('2026-06-01T14:30:00Z')
    expect(result).toContain('Jun 2026')
    expect(result).toMatch(/\d{2}:\d{2}/)
  })

  it('returns a fallback for an invalid timestamp', () => {
    expect(formatDateTime('garbage')).toBe('Unknown date')
  })
})

describe('ProspectStatusBadge', () => {
  it('renders the label from STATUS_META', () => {
    render(<ProspectStatusBadge status="reviewing" />)
    expect(screen.getByText('Reviewing')).toBeInTheDocument()
  })

  it('applies the badge class from STATUS_META', () => {
    render(<ProspectStatusBadge status="signed" />)
    const badge = screen.getByText('Signed')
    expect(badge.className).toContain('bg-emerald-50')
  })
})
