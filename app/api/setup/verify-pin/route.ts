import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const { pin } = await request.json()
  const correct = process.env.SETUP_PIN
  if (!correct) return NextResponse.json({ ok: false })
  return NextResponse.json({ ok: pin === correct })
}
