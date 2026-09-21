/**
 * Splits a chat message body into plain-text and link tokens so the renderer
 * can turn URLs into real anchors.
 *
 * Chat bodies were rendered as raw text, so a pasted link (the squad's Excel
 * tracker on SharePoint/OneDrive, a Google Sheet, a fixtures page) arrived as
 * dead text the lads had to select and copy by hand. This is the parsing half
 * of the fix; `components/chat/MessageBody.tsx` renders the tokens.
 *
 * Deliberately conservative — it is NOT a markdown parser:
 *  - only `http://`, `https://` and bare `www.` are recognised, so a
 *    `javascript:` payload can never become an anchor
 *  - the matched URL is never rewritten, only trimmed, so long query strings
 *    (`?e=4%3Axyz&at=9&download=1` — exactly what OneDrive share links look
 *    like) survive intact
 */

export type TextToken = { type: 'text'; value: string }
export type LinkToken = { type: 'link'; value: string; href: string }
export type Token = TextToken | LinkToken

// `[^\s<>]+` keeps every query-string character a share link may contain.
// The two alternatives are the only schemes we ever linkify.
const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s<>]+/gi

// Punctuation that almost always belongs to the surrounding sentence rather
// than the URL. A trailing `/` is legitimate, so it is not in this set.
const TRAILING_PUNCTUATION = /[.,;:!?'"]+$/

const CLOSERS: Record<string, string> = { ')': '(', ']': '[', '}': '{' }

/** True when `char` could be part of a preceding word — guards against
 *  matching the `www.` inside something like `bad-www.example.com`. */
function isWordish(char: string | undefined): boolean {
  return !!char && /[A-Za-z0-9@._-]/.test(char)
}

function countOf(haystack: string, needle: string): number {
  let n = 0
  for (const char of haystack) if (char === needle) n += 1
  return n
}

/**
 * Trims trailing characters that belong to the sentence, not the URL.
 * Runs until stable so `https://example.com/a).` loses both.
 */
function trimTrailing(url: string): string {
  let current = url
  for (;;) {
    const stripped = current.replace(TRAILING_PUNCTUATION, '')
    const last = stripped[stripped.length - 1]
    const opener = last ? CLOSERS[last] : undefined
    // Keep a closing bracket only when the URL opened it itself — Wikipedia
    // and SharePoint paths legitimately contain `(...)`.
    const unbalanced =
      !!opener && countOf(stripped, opener) < countOf(stripped, last as string)
    const next = unbalanced ? stripped.slice(0, -1) : stripped
    if (next === current) return next
    current = next
  }
}

export function tokenizeLinks(body: string): Token[] {
  if (!body) return []

  const tokens: Token[] = []
  let cursor = 0

  URL_PATTERN.lastIndex = 0
  for (let match = URL_PATTERN.exec(body); match; match = URL_PATTERN.exec(body)) {
    const start = match.index
    if (isWordish(body[start - 1])) continue

    const value = trimTrailing(match[0])
    if (!value) continue

    if (start > cursor) tokens.push({ type: 'text', value: body.slice(cursor, start) })
    tokens.push({
      type: 'link',
      value,
      href: /^www\./i.test(value) ? `https://${value}` : value,
    })

    cursor = start + value.length
    // The trim may have given characters back to the sentence — re-scan from
    // there so they are not swallowed.
    URL_PATTERN.lastIndex = cursor
  }

  if (cursor < body.length) tokens.push({ type: 'text', value: body.slice(cursor) })
  return tokens
}
