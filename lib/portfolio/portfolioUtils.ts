export interface PortfolioEntry {
  id: string
  student_id: string
  title: string
  description: string | null
  entry_type: EntryType
  tags: string[]
  media_url: string | null
  created_at: string
  updated_at: string
}

export type EntryType = 'achievement' | 'reflection' | 'goal' | 'evidence'

export const VALID_ENTRY_TYPES: readonly EntryType[] = [
  'achievement',
  'reflection',
  'goal',
  'evidence',
]

export const ENTRY_TYPE_LABELS: Record<EntryType, string> = {
  achievement: 'Achievement',
  reflection: 'Reflection',
  goal: 'Goal',
  evidence: 'Evidence',
}

export const ENTRY_TYPE_COLOURS: Record<EntryType, string> = {
  achievement: 'bg-yellow-100 text-yellow-800',
  reflection: 'bg-blue-100 text-blue-800',
  goal: 'bg-green-100 text-green-800',
  evidence: 'bg-purple-100 text-purple-800',
}

/**
 * Groups an array of portfolio entries by their entry_type.
 * All four types are always present in the result (empty array if no entries for that type).
 */
export function groupByType(entries: PortfolioEntry[]): Record<EntryType, PortfolioEntry[]> {
  const result: Record<EntryType, PortfolioEntry[]> = {
    achievement: [],
    reflection: [],
    goal: [],
    evidence: [],
  }
  for (const entry of entries) {
    result[entry.entry_type].push(entry)
  }
  return result
}

/**
 * Filters entries to only those containing the given tag (case-insensitive).
 */
export function filterByTag(entries: PortfolioEntry[], tag: string): PortfolioEntry[] {
  const normalised = tag.toLowerCase().trim()
  return entries.filter(e =>
    e.tags.some(t => t.toLowerCase().trim() === normalised)
  )
}

/**
 * Parses a comma-separated tags string into a trimmed, non-empty string array.
 */
export function parseTags(raw: string): string[] {
  return raw
    .split(',')
    .map(t => t.trim())
    .filter(t => t.length > 0)
}

/**
 * Returns true if the given string is a valid EntryType.
 */
export function isValidEntryType(value: string): value is EntryType {
  return (VALID_ENTRY_TYPES as readonly string[]).includes(value)
}
