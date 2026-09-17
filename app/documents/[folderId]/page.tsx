import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Folder } from 'lucide-react'
import { UploadDropzone } from '../UploadDropzone'
import { DocumentList } from './DocumentList'
import { DeleteFolderButton } from './DeleteFolderButton'
import { CreateFolderButton } from '../CreateFolderButton'

export const dynamic = 'force-dynamic'

export default async function DocumentFolderPage({ params }: { params: { folderId: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  let folder: { id: string; name: string; parent_id?: string | null } | null = null
  const nested = await admin.from('document_folders').select('id, name, parent_id').eq('id', params.folderId).maybeSingle()
  if (nested.error) {
    const flat = await admin.from('document_folders').select('id, name').eq('id', params.folderId).maybeSingle()
    folder = flat.data
  } else {
    folder = nested.data
  }
  if (!folder) notFound()

  const { data: me } = await admin.from('users').select('role').eq('id', user.id).maybeSingle()
  const isStaff = !!me && ['admin', 'coach', 'teacher'].includes(me.role)

  const { data: rows } = await admin
    .from('documents')
    .select('id, name, mime_type, size_bytes, storage_path, created_at')
    .eq('folder_id', params.folderId)
    .order('created_at', { ascending: false })

  let children: { id: string; name: string }[] = []
  const childQuery = await admin.from('document_folders').select('id, name').eq('parent_id', params.folderId).order('name')
  if (!childQuery.error) children = childQuery.data ?? []

  const documents = await Promise.all(
    (rows ?? []).map(async d => {
      const { data: signed } = await admin.storage.from('documents').createSignedUrl(d.storage_path, 3600)
      return {
        id: d.id,
        name: d.name,
        mime_type: d.mime_type,
        size_bytes: d.size_bytes,
        url: signed?.signedUrl ?? null,
      }
    })
  )

  const backHref = folder.parent_id ? `/documents/${folder.parent_id}` : '/documents'

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8 pb-24 md:pb-8 space-y-3 overflow-x-hidden">
      <div className="flex items-start gap-2">
        <Link href={backHref} className="p-2 -ml-2 rounded-lg active:bg-gray-100 shrink-0">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-xl sm:text-2xl font-bold text-tranmere-blue break-words min-w-0 flex-1">{folder.name}</h1>
        {isStaff && <DeleteFolderButton folderId={params.folderId} folderName={folder.name} />}
      </div>

      {isStaff && <CreateFolderButton parentId={params.folderId} />}
      {isStaff && <UploadDropzone folderId={params.folderId} />}

      {children.length > 0 && (
        <div className="rounded-2xl border bg-white divide-y">
          {children.map(child => (
            <Link key={child.id} href={`/documents/${child.id}`} className="flex items-center gap-3 p-3 active:bg-gray-50">
              <div className="w-10 h-10 rounded-full bg-tranmere-blue/10 text-tranmere-blue flex items-center justify-center shrink-0">
                <Folder size={18} />
              </div>
              <p className="font-medium text-sm break-words">{child.name}</p>
            </Link>
          ))}
        </div>
      )}

      <DocumentList documents={documents} isStaff={isStaff} />
    </div>
  )
}
