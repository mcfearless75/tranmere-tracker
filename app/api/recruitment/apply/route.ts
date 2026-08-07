import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { validateApplication, type ApplicationInput } from '@/lib/recruitment/recruitmentUtils'

export const dynamic = 'force-dynamic'

const PREFERRED_FEET = ['left', 'right', 'both'] as const

const OPTIONAL_FIELD_MAX = 120
const NOTES_MAX = 1000

/** Trims an optional free-text field and caps its length. Returns null when empty/absent. */
function cleanOptional(value: unknown, maxLength: number = OPTIONAL_FIELD_MAX): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().slice(0, maxLength)
  return trimmed.length > 0 ? trimmed : null
}

/**
 * PUBLIC endpoint — no auth. Accepts trial applications from the /trials landing
 * page and inserts them as recruitment prospects via the service role (the
 * recruitment tables are staff-only under RLS).
 */
export async function POST(request: NextRequest) {
  let body: ApplicationInput
  try {
    body = (await request.json()) as ApplicationInput
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  // Honeypot tripped — pretend it worked so bots learn nothing
  if (typeof body.website === 'string' && body.website.trim().length > 0) {
    return NextResponse.json({ success: true })
  }

  // Never trust the client — re-validate everything server-side
  const validation = validateApplication(body)
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  const preferredFoot = cleanOptional(body.preferred_foot)
  const preferred_foot = PREFERRED_FEET.find((f) => f === preferredFoot) ?? null

  const supabase = createAdminClient()

  // Lightweight abuse guard (no extra deps): this public endpoint writes
  // minors' PII, so cap accepted applications per rolling hour. Legitimate
  // volume is a handful a day; a flood is either a bot or a scripted attack.
  const HOURLY_CAP = 20
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count, error: countError } = await supabase
    .from('recruitment_prospects')
    .select('id', { count: 'exact', head: true })
    .eq('source', 'public_form')
    .gte('created_at', oneHourAgo)

  if (countError) {
    return NextResponse.json(
      { error: 'Unable to submit your application right now. Please try again later.' },
      { status: 500 }
    )
  }
  if ((count ?? 0) >= HOURLY_CAP) {
    return NextResponse.json(
      {
        error:
          'We are receiving a high number of applications at the moment. Please try again in an hour — your interest is not lost.',
      },
      { status: 429 }
    )
  }

  const { error } = await supabase.from('recruitment_prospects').insert({
    first_name: body.first_name.trim().slice(0, OPTIONAL_FIELD_MAX),
    last_name: body.last_name.trim().slice(0, OPTIONAL_FIELD_MAX),
    date_of_birth: body.date_of_birth,
    position: cleanOptional(body.position),
    preferred_foot,
    current_club: cleanOptional(body.current_club),
    contact_email: body.contact_email.trim().slice(0, OPTIONAL_FIELD_MAX),
    contact_phone: cleanOptional(body.contact_phone),
    parent_guardian_name: body.parent_guardian_name.trim().slice(0, OPTIONAL_FIELD_MAX),
    consent_given: body.consent_given === true,
    notes: cleanOptional(body.notes, NOTES_MAX),
    source: 'public_form',
  })

  if (error) {
    // Generic message — never echo PII or database details to an unauthenticated caller
    return NextResponse.json(
      { error: 'Unable to submit your application right now. Please try again later.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
