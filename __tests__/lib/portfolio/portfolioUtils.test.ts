import {
  groupByType,
  filterByTag,
  parseTags,
  isValidEntryType,
  ENTRY_TYPE_LABELS,
  ENTRY_TYPE_COLOURS,
  VALID_ENTRY_TYPES,
} from '@/lib/portfolio/portfolioUtils'
import type { PortfolioEntry, EntryType } from '@/lib/portfolio/portfolioUtils'

function makeEntry(overrides: Partial<PortfolioEntry> = {}): PortfolioEntry {
  return {
    id: 'entry-1',
    student_id: 'user-1',
    title: 'Test Entry',
    description: null,
    entry_type: 'achievement',
    tags: [],
    media_url: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

// ── ENTRY_TYPE_LABELS ──────────────────────────────────────────────────────────

describe('ENTRY_TYPE_LABELS', () => {
  it('has a label for every valid entry type', () => {
    for (const type of VALID_ENTRY_TYPES) {
      expect(ENTRY_TYPE_LABELS[type]).toBeTruthy()
    }
  })

  it('returns human-readable strings (not raw keys)', () => {
    expect(ENTRY_TYPE_LABELS.achievement).toBe('Achievement')
    expect(ENTRY_TYPE_LABELS.reflection).toBe('Reflection')
    expect(ENTRY_TYPE_LABELS.goal).toBe('Goal')
    expect(ENTRY_TYPE_LABELS.evidence).toBe('Evidence')
  })
})

// ── ENTRY_TYPE_COLOURS ─────────────────────────────────────────────────────────

describe('ENTRY_TYPE_COLOURS', () => {
  it('has a colour class for every valid entry type', () => {
    for (const type of VALID_ENTRY_TYPES) {
      expect(ENTRY_TYPE_COLOURS[type]).toBeTruthy()
    }
  })

  it('returns Tailwind class strings', () => {
    for (const type of VALID_ENTRY_TYPES) {
      expect(ENTRY_TYPE_COLOURS[type]).toMatch(/bg-\w+/)
    }
  })
})

// ── isValidEntryType ───────────────────────────────────────────────────────────

describe('isValidEntryType', () => {
  it('returns true for each valid type', () => {
    for (const type of VALID_ENTRY_TYPES) {
      expect(isValidEntryType(type)).toBe(true)
    }
  })

  it('returns false for an unknown string', () => {
    expect(isValidEntryType('unknown')).toBe(false)
  })

  it('returns false for an empty string', () => {
    expect(isValidEntryType('')).toBe(false)
  })
})

// ── groupByType ────────────────────────────────────────────────────────────────

describe('groupByType', () => {
  it('returns all four keys even when entries is empty', () => {
    const result = groupByType([])
    expect(Object.keys(result).sort()).toEqual(
      ['achievement', 'evidence', 'goal', 'reflection']
    )
  })

  it('places each entry under the correct type bucket', () => {
    const entries = [
      makeEntry({ id: '1', entry_type: 'achievement' }),
      makeEntry({ id: '2', entry_type: 'reflection' }),
      makeEntry({ id: '3', entry_type: 'achievement' }),
    ]
    const result = groupByType(entries)
    expect(result.achievement).toHaveLength(2)
    expect(result.reflection).toHaveLength(1)
    expect(result.goal).toHaveLength(0)
    expect(result.evidence).toHaveLength(0)
  })

  it('preserves the original entry objects (reference equality)', () => {
    const entry = makeEntry({ id: 'ref-test', entry_type: 'goal' })
    const result = groupByType([entry])
    expect(result.goal[0]).toBe(entry)
  })

  it('counts all four types correctly for a mixed set', () => {
    const types: EntryType[] = ['achievement', 'reflection', 'goal', 'evidence']
    const entries = types.map((t, i) => makeEntry({ id: String(i), entry_type: t }))
    const result = groupByType(entries)
    for (const type of types) {
      expect(result[type]).toHaveLength(1)
    }
  })
})

// ── filterByTag ────────────────────────────────────────────────────────────────

describe('filterByTag', () => {
  it('returns only entries that include the given tag', () => {
    const entries = [
      makeEntry({ id: '1', tags: ['teamwork', 'skills'] }),
      makeEntry({ id: '2', tags: ['leadership'] }),
      makeEntry({ id: '3', tags: ['teamwork'] }),
    ]
    const result = filterByTag(entries, 'teamwork')
    expect(result).toHaveLength(2)
    expect(result.map(e => e.id)).toEqual(['1', '3'])
  })

  it('returns empty array when no entries match the tag', () => {
    const entries = [makeEntry({ tags: ['skills'] })]
    expect(filterByTag(entries, 'teamwork')).toEqual([])
  })

  it('is case-insensitive', () => {
    const entries = [makeEntry({ tags: ['Teamwork'] })]
    expect(filterByTag(entries, 'TEAMWORK')).toHaveLength(1)
  })

  it('returns empty array when passed an empty entries list', () => {
    expect(filterByTag([], 'teamwork')).toEqual([])
  })
})

// ── parseTags ──────────────────────────────────────────────────────────────────

describe('parseTags', () => {
  it('splits a comma-separated string into trimmed tags', () => {
    expect(parseTags('teamwork, skills, leadership')).toEqual([
      'teamwork',
      'skills',
      'leadership',
    ])
  })

  it('returns empty array for an empty string', () => {
    expect(parseTags('')).toEqual([])
  })

  it('filters out blank entries between consecutive commas', () => {
    expect(parseTags('a,,b')).toEqual(['a', 'b'])
  })

  it('trims whitespace from each tag', () => {
    expect(parseTags('  tag1 ,  tag2  ')).toEqual(['tag1', 'tag2'])
  })

  it('handles a single tag with no commas', () => {
    expect(parseTags('leadership')).toEqual(['leadership'])
  })
})
