import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Accepts multipart/form-data with 'file' + 'assignment_id' + optional 'kind'.
// Auto-creates the 'coursework' storage bucket if missing.
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await request.formData()
  const file = form.get('file') as File | null
  const assignmentId = form.get('assignment_id') as string | null
  const kind = (form.get('kind') as string | null) ?? 'file'

  if (!file || !assignmentId) {
    return NextResponse.json({ error: 'file and assignment_id required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Ensure bucket exists (idempotent)
  await admin.storage.createBucket('coursework', { public: true, fileSizeLimit: 20 * 1024 * 1024 }).catch(() => {})

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80)
  const path = `${user.id}/${assignmentId}-${Date.now()}-${safeName}`
  const bytes = await file.arrayBuffer()

  const { error: upErr } = await admin.storage
    .from('coursework')
    .upload(path, bytes, { contentType: file.type || 'application/octet-stream', upsert: true })

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  const { data: urlData } = admin.storage.from('coursework').getPublicUrl(path)

  // Ensure submission row exists, bump status to at least 'in_progress'
  const { data: existing } = await admin
    .from('submissions')
    .select('id, status')
    .eq('assignment_id', assignmentId)
    .eq('student_id', user.id)
    .maybeSingle()

  let submissionId = existing?.id
  if (!existing) {
    const { data: created } = await admin
      .from('submissions')
      .insert({
        assignment_id: assignmentId,
        student_id: user.id,
        status: 'in_progress',
      })
      .select('id')
      .single()
    submissionId = created?.id
  } else if (existing.status === 'not_started') {
    await admin.from('submissions').update({ status: 'in_progress' }).eq('id', existing.id)
  }

  if (!submissionId) return NextResponse.json({ error: 'Could not create submission' }, { status: 500 })

  const { data: inserted } = await admin.from('submission_evidence').insert({
    submission_id: submissionId,
    student_id: user.id,
    kind,
    url: urlData.publicUrl,
    filename: file.name,
  }).select('*').single()

  return NextResponse.json({ success: true, evidence: inserted })
}
