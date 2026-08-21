import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { FolderOpen, Folder } from 'lucide-react'
import { CreateFolderButton } from './CreateFolderButton'

export const dynamic = 'force-dynamic'

export default async function DocumentsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: me } = await admin.from('users').select('role').eq('id', user.id).maybeSingle()
  const isStaff = !!me && ['admin', 'coach', 'teacher'].includes(me.role)

  const [{ data: folders }, { data: allDocs }] = await Promise.all([
    admin.from('document_folders').select('id, name, created_at').order('name'),
    // Unfiltered per-file fetch to compute counts client-side. PostgREST caps
    // result sets at the project's db-max-rows (default 1000) — past that,
    // counts silently under-report. Fine at this app's scale; revisit with a
    // count-aggregate view/RPC if the repository grows into the thousands.
    admin.from('documents').select('folder_id'),
  ])

  const countByFolder: Record<string, number> = {}
  for (const d of allDocs ?? []) countByFolder[d.folder_id] = (countByFolder[d.folder_id] ?? 0) + 1

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8 pb-24 md:pb-8 space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-bold text-tranmere-blue flex items-center gap-1.5">
          <FolderOpen size={22} /> Documents
        </h1>
      </div>

      {isStaff && <CreateFolderButton />}

      {(folders ?? []).length === 0 ? (
        <div className="rounded-2xl border bg-white p-8 text-center text-sm text-muted-foreground">
          No folders yet.
        </div>
      ) : (
        <div className="rounded-2xl border bg-white divide-y">
          {(folders ?? []).map(f => (
            <Link
              key={f.id}
              href={`/documents/${f.id}`}
              className="flex items-center gap-3 p-3 hover:bg-gray-50 active:bg-gray-100"
            >
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-tranmere-blue to-blue-900 flex items-center justify-center text-white shrink-0">
                <Folder size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{f.name}</p>
                <p className="text-xs text-muted-foreground">
                  {countByFolder[f.id] ?? 0} file{countByFolder[f.id] === 1 ? '' : 's'}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
