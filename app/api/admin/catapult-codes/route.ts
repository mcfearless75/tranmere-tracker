import { requireStaff } from '@/lib/auth/requireRole'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const auth = await requireStaff()
  if (!auth.ok) return auth.response
  const { admin } = auth.ctx

  const body = await request.json().catch(() => null) as { updates?: { id: string; code: string }[] } | null
  const updates = body?.updates ?? []
  if (!Array.isArray(updates) || updates.length === 0) {
    return NextResponse.json({ error: 'No updates' }, { status: 400 })
  }

  const failed: string[] = []
  for (const row of updates.slice(0, 80)) {
    const code = (row.code || '').trim()
    const { error } = await admin
      .from('users')
      .update({ catapult_code: code || null })
      .eq('id', row.id)
      .eq('role', 'student')
    if (error) failed.push(error.message)
  }

  if (failed.length) {
    return NextResponse.json({ error: failed[0] }, { status: 400 })
  }
  return NextResponse.json({ ok: true, saved: updates.length })
}
