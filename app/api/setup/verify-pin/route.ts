import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const { pin } = await request.json()
  const correct = process.env.SETUP_PIN
  // If no PIN configured, skip gate entirely
  if (!correct) return NextResponse.json({ ok: true })
  return NextResponse.json({ ok: pin === correct })
}
