import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { UploadDropzone } from '../UploadDropzone'
import { DocumentList } from './DocumentList'
import { DeleteFolderButton } from './DeleteFolderButton'

export const dynamic = 'force-dynamic'

export default async function DocumentFolderPage({ params }: { params: { folderId: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: folder } = await admin.from('document_folders').select('id, name').eq('id', params.folderId).maybeSingle()
  if (!folder) notFound()

  const { data: me } = await admin.from('users').select('role').eq('id', user.id).maybeSingle()
  const isStaff = !!me && ['admin', 'coach', 'teacher'].includes(me.role)

  const { data: rows } = await admin
    .from('documents')
    .select('id, name, mime_type, size_bytes, storage_path, created_at')
    .eq('folder_id', params.folderId)
    .order('created_at', { ascending: false })

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

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8 pb-24 md:pb-8 space-y-3">
      <div className="flex items-center gap-2">
        <Link href="/documents" className="p-2 -ml-2 rounded-lg active:bg-gray-100">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-xl sm:text-2xl font-bold text-tranmere-blue truncate">{folder.name}</h1>
        {isStaff && <DeleteFolderButton folderId={params.folderId} folderName={folder.name} />}
      </div>

      {isStaff && <UploadDropzone folderId={params.folderId} />}

      <DocumentList documents={documents} isStaff={isStaff} />
    </div>
  )
}
