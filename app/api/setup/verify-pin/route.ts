import { NextResponse } from 'next/server'
import { safeEqual } from '@/lib/security'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  let pin: unknown
  try {
    ;({ pin } = await request.json())
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  // Fail CLOSED: if no setup PIN is configured the gate is locked, not open.
  const correct = process.env.SETUP_PIN
  if (!correct) return NextResponse.json({ ok: false }, { status: 403 })

  // Constant-time compare — no early-exit timing signal on partial matches.
  const ok = safeEqual(typeof pin === 'string' ? pin : null, correct)
  return NextResponse.json({ ok })
}
