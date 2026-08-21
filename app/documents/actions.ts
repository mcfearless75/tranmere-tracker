'use server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'

/** True if userId belongs to a staff user (admin/coach/teacher). */
async function requireStaff(admin: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await admin.from('users').select('role').eq('id', userId).maybeSingle()
  return !!data && ['admin', 'coach', 'teacher'].includes(data.role)
}

/** Create a new document folder. Staff-only. */
export async function createFolder(name: string): Promise<string | { error: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const admin = createAdminClient()
  if (!await requireStaff(admin, user.id)) return { error: 'Staff only' }

  const trimmedName = name.trim()
  if (!trimmedName) return { error: 'Folder needs a name' }

  const { data: folder, error } = await admin
    .from('document_folders')
    .insert({ name: trimmedName, created_by: user.id })
    .select('id')
    .single()
  if (error || !folder) return { error: error?.message ?? 'Could not create folder' }

  revalidatePath('/documents')
  return folder.id
}

/** Delete a folder: removes every stored file's bytes, then the folder row
 *  (DB cascade removes the `documents` rows). Staff-only. */
export async function deleteFolder(folderId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Unauthorized' }

  const admin = createAdminClient()
  if (!await requireStaff(admin, user.id)) return { ok: false, error: 'Staff only' }

  const { data: files } = await admin.from('documents').select('storage_path').eq('folder_id', folderId)
  const paths = (files ?? []).map(f => f.storage_path)
  if (paths.length > 0) {
    await admin.storage.from('documents').remove(paths)
  }

  const { error } = await admin.from('document_folders').delete().eq('id', folderId)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/documents')
  return { ok: true }
}

/** Record a successfully-uploaded file as a `documents` row. Staff-only.
 *  Called after the browser has already uploaded the bytes to Storage. */
export async function recordDocument(
  folderId: string,
  storagePath: string,
  name: string,
  mimeType: string,
  sizeBytes: number,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Unauthorized' }

  const admin = createAdminClient()
  if (!await requireStaff(admin, user.id)) return { ok: false, error: 'Staff only' }

  const { error } = await admin.from('documents').insert({
    folder_id: folderId,
    name,
    storage_path: storagePath,
    mime_type: mimeType,
    size_bytes: sizeBytes,
    uploaded_by: user.id,
  })
  if (error) {
    // Don't leave an orphaned file nobody can see or clean up.
    await admin.storage.from('documents').remove([storagePath])
    return { ok: false, error: error.message }
  }

  revalidatePath(`/documents/${folderId}`)
  return { ok: true }
}

/** Delete one file: removes the storage object and the `documents` row. Staff-only. */
export async function deleteDocument(documentId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Unauthorized' }

  const admin = createAdminClient()
  if (!await requireStaff(admin, user.id)) return { ok: false, error: 'Staff only' }

  const { data: doc } = await admin.from('documents').select('folder_id, storage_path').eq('id', documentId).maybeSingle()
  if (!doc) return { ok: false, error: 'File not found' }

  await admin.storage.from('documents').remove([doc.storage_path])

  const { error } = await admin.from('documents').delete().eq('id', documentId)
  if (error) return { ok: false, error: error.message }

  revalidatePath(`/documents/${doc.folder_id}`)
  return { ok: true }
}
