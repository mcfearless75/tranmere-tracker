/** 0-indexed months that start a new term */
const TERM_START_MONTHS = new Set([0, 3, 8]) // January, April, September

/**
 * Returns the term label for the given date.
 * - Sep–Dec → "Autumn YYYY"
 * - Jan–Apr → "Spring YYYY"
 * - May–Aug → "Summer YYYY"
 */
export function getCurrentTerm(date: Date): string {
  const month = date.getMonth() // 0-indexed
  const year = date.getFullYear()

  if (month >= 8) return `Autumn ${year}`
  if (month <= 3) return `Spring ${year}`
  return `Summer ${year}`
}

/**
 * Returns true if the given 0-indexed month is a term-start month
 * (January=0, April=3, September=8).
 */
export function isTermStartMonth(month: number): boolean {
  return TERM_START_MONTHS.has(month)
}

/**
 * Returns true if a review with the given termLabel already exists
 * in the provided reviews array.
 */
export function termAlreadyExists(
  reviews: { term: string }[],
  termLabel: string
): boolean {
  return reviews.some(r => r.term === termLabel)
}
