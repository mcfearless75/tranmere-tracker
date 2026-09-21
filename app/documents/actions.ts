'use server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'

async function requireStaff(admin: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await admin.from('users').select('role').eq('id', userId).maybeSingle()
  return !!data && ['admin', 'coach', 'teacher'].includes(data.role)
}

function cleanName(name: string, max = 80): string | { error: string } {
  const trimmedName = name.trim().replace(/\s+/g, ' ')
  if (!trimmedName) return { error: 'Needs a name' }
  if (trimmedName.length > max) return { error: `Name must be ${max} characters or fewer` }
  return trimmedName
}

export async function createFolder(name: string, parentId?: string): Promise<string | { error: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const admin = createAdminClient()
  if (!await requireStaff(admin, user.id)) return { error: 'Staff only' }

  const trimmedName = cleanName(name, 60)
  if (typeof trimmedName !== 'string') return trimmedName

  const row: { name: string; created_by: string; parent_id?: string } = {
    name: trimmedName,
    created_by: user.id,
  }
  if (parentId) {
    const { data: parent } = await admin.from('document_folders').select('id').eq('id', parentId).maybeSingle()
    if (!parent) return { error: 'Parent folder not found' }
    row.parent_id = parentId
  }

  const { data: folder, error } = await admin
    .from('document_folders')
    .insert(row)
    .select('id')
    .single()
  if (error || !folder) {
    const msg = error?.message ?? 'Could not create folder'
    if (msg.includes('parent_id') || msg.includes('schema cache')) {
      return { error: 'Run supabase/migrations/081_document_folder_parent.sql in the Supabase SQL editor, then try again.' }
    }
    return { error: msg }
  }

  revalidatePath('/documents')
  if (parentId) revalidatePath(`/documents/${parentId}`)
  return folder.id
}

export async function renameFolder(folderId: string, name: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Unauthorized' }
  const admin = createAdminClient()
  if (!await requireStaff(admin, user.id)) return { ok: false, error: 'Staff only' }
  const trimmedName = cleanName(name, 60)
  if (typeof trimmedName !== 'string') return { ok: false, error: trimmedName.error }
  const { error } = await admin.from('document_folders').update({ name: trimmedName }).eq('id', folderId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/documents')
  revalidatePath(`/documents/${folderId}`)
  return { ok: true }
}

export async function renameDocument(documentId: string, name: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Unauthorized' }
  const admin = createAdminClient()
  if (!await requireStaff(admin, user.id)) return { ok: false, error: 'Staff only' }
  const trimmedName = cleanName(name, 120)
  if (typeof trimmedName !== 'string') return { ok: false, error: trimmedName.error }
  const { data: doc } = await admin.from('documents').select('id, folder_id').eq('id', documentId).maybeSingle()
  if (!doc) return { ok: false, error: 'File not found' }
  const { error } = await admin.from('documents').update({ name: trimmedName }).eq('id', documentId)
  if (error) return { ok: false, error: error.message }
  revalidatePath(`/documents/${doc.folder_id}`)
  return { ok: true }
}

export async function moveDocument(documentId: string, targetFolderId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Unauthorized' }
  const admin = createAdminClient()
  if (!await requireStaff(admin, user.id)) return { ok: false, error: 'Staff only' }

  const { data: doc } = await admin.from('documents').select('id, folder_id').eq('id', documentId).maybeSingle()
  if (!doc) return { ok: false, error: 'File not found' }
  if (doc.folder_id === targetFolderId) return { ok: true }

  const { data: dest } = await admin.from('document_folders').select('id').eq('id', targetFolderId).maybeSingle()
  if (!dest) return { ok: false, error: 'Folder not found' }

  const { error } = await admin.from('documents').update({ folder_id: targetFolderId }).eq('id', documentId)
  if (error) return { ok: false, error: error.message }

  revalidatePath(`/documents/${doc.folder_id}`)
  revalidatePath(`/documents/${targetFolderId}`)
  return { ok: true }
}

async function collectFolderTree(admin: SupabaseClient, rootId: string): Promise<string[]> {
  const ids = [rootId]
  const { data: all } = await admin.from('document_folders').select('id, parent_id')
  const childrenOf = new Map<string, string[]>()
  for (const f of all ?? []) {
    if (!f.parent_id) continue
    const list = childrenOf.get(f.parent_id) ?? []
    list.push(f.id)
    childrenOf.set(f.parent_id, list)
  }
  const stack = [rootId]
  while (stack.length) {
    const id = stack.pop()!
    for (const child of childrenOf.get(id) ?? []) {
      ids.push(child)
      stack.push(child)
    }
  }
  return ids
}

export async function deleteFolder(folderId: string): Promise<{ ok: boolean; parentId?: string | null; error?: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Unauthorized' }

  const admin = createAdminClient()
  if (!await requireStaff(admin, user.id)) return { ok: false, error: 'Staff only' }

  const { data: folder } = await admin.from('document_folders').select('parent_id').eq('id', folderId).maybeSingle()
  const tree = await collectFolderTree(admin, folderId)
  const { data: files } = await admin.from('documents').select('storage_path').in('folder_id', tree)
  const paths = (files ?? []).map(f => f.storage_path)
  if (paths.length > 0) {
    await admin.storage.from('documents').remove(paths)
  }

  const { error } = await admin.from('document_folders').delete().eq('id', folderId)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/documents')
  return { ok: true, parentId: folder?.parent_id ?? null }
}

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

  if (!storagePath.startsWith(`${folderId}/`)) return { ok: false, error: 'Invalid file path' }

  const { error } = await admin.from('documents').insert({
    folder_id: folderId,
    name,
    storage_path: storagePath,
    mime_type: mimeType,
    size_bytes: sizeBytes,
    uploaded_by: user.id,
  })
  if (error) {
    await admin.storage.from('documents').remove([storagePath])
    return { ok: false, error: error.message }
  }

  revalidatePath(`/documents/${folderId}`)
  return { ok: true }
}

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
