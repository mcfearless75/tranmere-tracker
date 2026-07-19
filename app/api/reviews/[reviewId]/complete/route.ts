import { requireStaff } from '@/lib/auth/requireRole'
import { NextRequest, NextResponse } from 'next/server'
import { canMarkComplete } from '@/lib/learnerReview/reviewUtils'

export async function PATCH(
  _req: NextRequest,
  { params }: { params: { reviewId: string } }
) {
  const auth = await requireStaff()
  if (!auth.ok) return auth.response
  const { admin } = auth.ctx

  const { data: review } = await admin
    .from('learner_reviews')
    .select('id, status')
    .eq('id', params.reviewId)
    .maybeSingle()

  if (!review) return NextResponse.json({ error: 'Review not found' }, { status: 404 })

  const check = canMarkComplete(review.status)
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 })

  const { error } = await admin
    .from('learner_reviews')
    .update({ status: 'complete', completed_at: new Date().toISOString() })
    .eq('id', params.reviewId)

  if (error) return NextResponse.json({ error: 'Failed to update review' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
