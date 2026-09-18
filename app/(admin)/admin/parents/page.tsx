import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { InviteParentForm, ParentRow } from './InviteParentForm'

export const dynamic = 'force-dynamic'

export default async function ParentsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const [{ data: students }, { data: links }, { data: room }] = await Promise.all([
    admin.from('users').select('id, name').eq('role', 'student').eq('is_active', true).order('name'),
    admin.from('parent_student_links').select('parent_id, student_id, users:parent_id(id, name), student:student_id(name)'),
    admin.from('chat_rooms').select('id').eq('kind', 'parent').eq('name', 'Parents').maybeSingle(),
  ])

  const byParent = new Map<string, { id: string; name: string; kids: string[] }>()
  for (const row of links ?? []) {
    const p = (row as any).users as { id: string; name: string } | null
    const kid = (row as any).student as { name: string } | null
    if (!p) continue
    const entry = byParent.get(p.id) ?? { id: p.id, name: p.name, kids: [] }
    if (kid?.name) entry.kids.push(kid.name)
    byParent.set(p.id, entry)
  }

  return (
    <div className="space-y-5 p-4 max-w-xl">
      <div>
        <h1 className="text-xl font-bold text-tranmere-blue">Parents</h1>
        <p className="text-sm text-muted-foreground">
          Create a login, copy the invite, they join the Parents group. Use Message for a private chat.
        </p>
        {room && (
          <a href={`/chat/${room.id}`} className="text-sm font-semibold text-tranmere-blue mt-1 inline-block">Open Parents group</a>
        )}
      </div>
      <InviteParentForm students={students ?? []} />
      <div className="bg-white rounded-xl border px-4 divide-y">
        {Array.from(byParent.values()).length === 0 && (
          <p className="text-sm text-muted-foreground py-6 text-center">No parents linked yet.</p>
        )}
        {Array.from(byParent.values()).map(p => (
          <ParentRow key={p.id} parentId={p.id} name={p.name} childrenNames={p.kids.join(', ')} />
        ))}
      </div>
    </div>
  )
}
