/**
 * What to tell someone on the login page, based on where they were heading.
 * A student arriving from the check-in sticker (a `/attendance?tag=…` link)
 * is about to do a one-off login on the canonical domain and then get a
 * location prompt — both worth a sentence, or the questions land on Paul.
 */
export type LoginContext = {
  /** They came from a sticker tap/scan. */
  checkIn: boolean
  /** They were bounced here from the old domain (canonical-host redirect). */
  moved: boolean
}

export function describeLoginContext(next: string | null | undefined): LoginContext {
  if (!next) return { checkIn: false, moved: false }
  let url: URL
  try {
    url = new URL(next, 'http://ctx.invalid')
  } catch {
    return { checkIn: false, moved: false }
  }
  const checkIn = url.pathname === '/attendance' && url.searchParams.has('tag')
  const moved = url.searchParams.get('moved') === '1'
  return { checkIn, moved }
}
