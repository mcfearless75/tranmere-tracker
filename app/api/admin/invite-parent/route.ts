import { requireStaff } from '@/lib/auth/requireRole'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function slug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 24) || 'parent'
}

function pin() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

export async function POST(request: Request) {
  const auth = await requireStaff()
  if (!auth.ok) return auth.response
  const { admin } = auth.ctx

  const body = await request.json().catch(() => null) as {
    studentId?: string
    parentName?: string
    email?: string
  } | null

  const studentId = body?.studentId ?? ''
  const parentName = (body?.parentName ?? '').trim()
  const email = (body?.email ?? '').trim().toLowerCase()
  if (!studentId || !parentName) {
    return NextResponse.json({ error: 'Student and parent name required' }, { status: 400 })
  }

  const { data: student } = await admin.from('users').select('id, name').eq('id', studentId).eq('role', 'student').maybeSingle()
  if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 })

  const username = slug(parentName) + '_' + student.name.toLowerCase().split(' ')[0]
  const internalEmail = email && email.includes('@') ? email : `${username}@tranmeretracker.internal`
  const password = pin()

  const { data: existingProfile } = await admin.from('users').select('id, role').eq('email', internalEmail).maybeSingle()

  let parentId = existingProfile?.id ?? null
  if (parentId && existingProfile?.role !== 'parent') {
    return NextResponse.json({ error: 'That email already belongs to a non-parent account' }, { status: 409 })
  }

  if (!parentId) {
    const { data: created, error: authError } = await admin.auth.admin.createUser({
      email: internalEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: parentName },
    })
    if (authError || !created.user) {
      return NextResponse.json({ error: authError?.message ?? 'Could not create login' }, { status: 400 })
    }
    parentId = created.user.id
    const { error: profileError } = await admin.from('users').upsert({
      id: parentId,
      email: internalEmail,
      name: parentName,
      role: 'parent',
      must_change_pin: true,
    })
    if (profileError) {
      await admin.auth.admin.deleteUser(parentId)
      return NextResponse.json({ error: profileError.message }, { status: 400 })
    }
  } else {
    await admin.auth.admin.updateUserById(parentId, { password })
  }

  await admin.from('parent_student_links').upsert(
    { parent_id: parentId, student_id: studentId },
    { onConflict: 'parent_id,student_id' },
  )

  const { data: room } = await admin.from('chat_rooms').select('id').eq('kind', 'parent').eq('name', 'Parents').maybeSingle()
  let roomId = room?.id
  if (!roomId) {
    const { data: createdRoom } = await admin.from('chat_rooms').insert({ kind: 'parent', name: 'Parents' }).select('id').single()
    roomId = createdRoom?.id
  }
  if (roomId) {
    await admin.from('chat_members').upsert(
      { room_id: roomId, user_id: parentId, role: 'member' },
      { onConflict: 'room_id,user_id' },
    )
  }

  return NextResponse.json({
    ok: true,
    parentId,
    login: internalEmail.includes('@tranmeretracker.internal') ? username : internalEmail,
    pin: password,
    studentName: student.name,
  })
}
