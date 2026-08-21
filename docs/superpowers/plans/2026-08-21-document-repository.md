# Document Repository Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A shared `/documents` area where staff (admin/coach/teacher) create flat folders and drag-and-drop upload files (PDF/Word/Excel/JPG/PNG), and everyone (students, parents, staff) can browse and download them.

**Architecture:** One shared top-level route, `app/documents/`, not role-prefixed — the same shape `app/chat/` already uses. Two new tables (`document_folders`, `documents`) plus a new private Storage bucket (`documents`), all staff-write/everyone-read via the existing `public.is_staff()` RLS helper. Signed download URLs are resolved server-side (admin client) at page-render time, not client-side.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase (`@supabase/ssr` + admin client + Storage), Tailwind, Jest + Testing Library.

## Global Constraints

- Use `.maybeSingle()` for any Supabase lookup that may legitimately return no row (per `CLAUDE.md`).
- Server actions must re-verify the caller's role against the DB on every call — never trust client-supplied booleans. Matches every server action built in the group-chat feature (`app/chat/actions.ts`).
- New document-repository components live at `app/documents/` and `app/documents/[folderId]/`, following the exact co-location pattern `app/chat/` and `app/chat/[roomId]/` already established — not the shared `components/` directory.
- One migration file, `supabase/migrations/045_documents.sql`, following the existing numbering convention. **Not applied automatically by any task in this plan** — written and committed only; a human runs it in the Supabase SQL Editor afterward (no live DB access exists in this environment, same as every migration in the group-chat plan).
- New bucket `documents` (private, 20MB/file cap, restricted MIME types) — deliberately not the existing unused `coursework` bucket, which is a different, unrelated concept.
- Jest coverage targets React components only, matching this codebase's established convention (zero API-route/server-action/page-level Jest coverage anywhere). Server actions, the migration, and the two `page.tsx` server components are verified live, not unit-tested.
- Mobile nav crowding (student bottom bar going from 6→7 items, parent from 7→8, both with no overflow menu) is an accepted, deliberate tradeoff per explicit approval — not a defect to fix in this plan.

---

### Task 1: Migration — tables, RLS, storage bucket + policies

**Files:**
- Create: `supabase/migrations/045_documents.sql`

**Interfaces:**
- Produces: `document_folders` table (`id, name, created_by, created_at`), `documents` table (`id, folder_id, name, storage_path, mime_type, size_bytes, uploaded_by, created_at`), a private `documents` Storage bucket, and the RLS/storage policies gating writes to staff. Every later task depends on these table/column names and the bucket name (`'documents'`) exactly.

- [ ] **Step 1: Write the migration file**

```sql
-- 045_documents.sql
-- Document repository: staff-managed folders of shared files (PDFs, Office
-- docs, images), browsable and downloadable by everyone.
-- Run in Supabase SQL Editor.

create table if not exists document_folders (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  created_by  uuid references public.users(id),
  created_at  timestamptz default now()
);

create table if not exists documents (
  id            uuid primary key default uuid_generate_v4(),
  folder_id     uuid not null references document_folders(id) on delete cascade,
  name          text not null,
  storage_path  text not null,
  mime_type     text not null,
  size_bytes    bigint not null,
  uploaded_by   uuid references public.users(id),
  created_at    timestamptz default now()
);

create index if not exists documents_folder_id_idx on documents(folder_id);

alter table document_folders enable row level security;
alter table documents enable row level security;

drop policy if exists "everyone can read document_folders" on document_folders;
create policy "everyone can read document_folders"
  on document_folders for select using (auth.uid() is not null);

drop policy if exists "staff manage document_folders" on document_folders;
create policy "staff manage document_folders"
  on document_folders for all using (public.is_staff());

drop policy if exists "everyone can read documents" on documents;
create policy "everyone can read documents"
  on documents for select using (auth.uid() is not null);

drop policy if exists "staff manage documents" on documents;
create policy "staff manage documents"
  on documents for all using (public.is_staff());

-- Storage bucket for the actual file bytes.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents', 'documents', false, 20971520,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png'
  ]
)
on conflict (id) do nothing;

-- Any authenticated user can read (download) any object in this bucket.
drop policy if exists "documents_auth_read" on storage.objects;
create policy "documents_auth_read" on storage.objects
  for select using (bucket_id = 'documents' and auth.uid() is not null);

-- Only staff can upload.
drop policy if exists "documents_staff_insert" on storage.objects;
create policy "documents_staff_insert" on storage.objects
  for insert with check (bucket_id = 'documents' and public.is_staff());

-- Only staff can delete objects (file/folder deletion).
drop policy if exists "documents_staff_delete" on storage.objects;
create policy "documents_staff_delete" on storage.objects
  for delete using (bucket_id = 'documents' and public.is_staff());
```

- [ ] **Step 2: Self-check against existing conventions**

Read `supabase/migrations/014_attendance_storage.sql` (bucket creation
pattern) and `supabase/migrations/011_chat.sql` (`public.is_staff()` usage
in a table policy — search for `"staff manage rooms"`) side by side with
the new file. Confirm: the bucket-insert shape matches
`014_attendance_storage.sql` exactly (`id, name, public, file_size_limit,
allowed_mime_types` + `on conflict (id) do nothing`), and `using
(public.is_staff())` is valid, already-proven syntax (it's exactly what
`011_chat.sql`'s `"staff manage rooms"` policy uses).

No automated test is possible for a migration file in this repo (no
existing migration has Jest coverage) — this step is the verification.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/045_documents.sql
git commit -m "feat: add document repository migration (tables, RLS, storage bucket)"
```

Do **not** run this migration against Supabase yet — the final task's
manual-verification note covers that, after every other task has landed.

---

### Task 2: Server actions — create/delete folder, record/delete document

**Files:**
- Create: `app/documents/actions.ts`

**Interfaces:**
- Consumes: `createClient()`, `createAdminClient()` from `@/lib/supabase/*`; `SupabaseClient` type from `@supabase/supabase-js`.
- Produces:
  - `createFolder(name: string): Promise<string | { error: string }>`
  - `deleteFolder(folderId: string): Promise<{ ok: boolean; error?: string }>`
  - `recordDocument(folderId: string, storagePath: string, name: string, mimeType: string, sizeBytes: number): Promise<{ ok: boolean; error?: string }>`
  - `deleteDocument(documentId: string): Promise<{ ok: boolean; error?: string }>`

  These four are consumed by Task 3 (`CreateFolderButton`), Task 5
  (`UploadDropzone`), and Task 6 (`DocumentList`).

- [ ] **Step 1: Write `app/documents/actions.ts`**

```ts
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
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors from `app/documents/actions.ts`.

- [ ] **Step 3: Commit**

```bash
git add app/documents/actions.ts
git commit -m "feat: add document repository server actions"
```

---

### Task 3: `CreateFolderButton` component

**Files:**
- Create: `app/documents/CreateFolderButton.tsx`
- Test: `__tests__/components/documents/CreateFolderButton.test.tsx`

**Interfaces:**
- Consumes: `createFolder` from `./actions` (Task 2).
- Produces: `CreateFolderButton()` (no props). Consumed by Task 4 (`app/documents/page.tsx`).

- [ ] **Step 1: Write the failing test**

Create `__tests__/components/documents/CreateFolderButton.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CreateFolderButton } from '@/app/documents/CreateFolderButton'

const refreshMock = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: refreshMock }) }))

const createFolderMock = jest.fn()
jest.mock('@/app/documents/actions', () => ({
  createFolder: (...args: any[]) => createFolderMock(...args),
}))

describe('CreateFolderButton', () => {
  beforeEach(() => {
    refreshMock.mockClear()
    createFolderMock.mockReset()
  })

  it('opens the form on click', () => {
    render(<CreateFolderButton />)
    fireEvent.click(screen.getByText('New folder'))
    expect(screen.getByPlaceholderText(/Folder name/)).toBeInTheDocument()
  })

  it('shows an error instead of submitting when no name is entered', () => {
    render(<CreateFolderButton />)
    fireEvent.click(screen.getByText('New folder'))
    fireEvent.click(screen.getByText('Create folder'))
    expect(screen.getByText('Give the folder a name')).toBeInTheDocument()
    expect(createFolderMock).not.toHaveBeenCalled()
  })

  it('submits the trimmed name and refreshes on success', async () => {
    createFolderMock.mockResolvedValue('folder-123')
    render(<CreateFolderButton />)
    fireEvent.click(screen.getByText('New folder'))
    fireEvent.change(screen.getByPlaceholderText(/Folder name/), { target: { value: '  Bursary Information  ' } })
    fireEvent.click(screen.getByText('Create folder'))
    await waitFor(() => expect(createFolderMock).toHaveBeenCalledWith('Bursary Information'))
    await waitFor(() => expect(refreshMock).toHaveBeenCalled())
  })

  it('shows the server error message on failure', async () => {
    createFolderMock.mockResolvedValue({ error: 'Staff only' })
    render(<CreateFolderButton />)
    fireEvent.click(screen.getByText('New folder'))
    fireEvent.change(screen.getByPlaceholderText(/Folder name/), { target: { value: 'Test' } })
    fireEvent.click(screen.getByText('Create folder'))
    await waitFor(() => expect(screen.getByText('Staff only')).toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- __tests__/components/documents/CreateFolderButton.test.tsx`
Expected: FAIL with "Cannot find module '@/app/documents/CreateFolderButton'"

- [ ] **Step 3: Write `app/documents/CreateFolderButton.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FolderPlus, X } from 'lucide-react'
import { createFolder } from './actions'

export function CreateFolderButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setError(null)
    if (!name.trim()) { setError('Give the folder a name'); return }
    setSubmitting(true)
    const res = await createFolder(name.trim())
    setSubmitting(false)
    if (typeof res === 'string') {
      setName('')
      setOpen(false)
      router.refresh()
    } else {
      setError(res.error)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-tranmere-blue text-tranmere-blue px-4 py-2.5 text-sm font-semibold hover:bg-tranmere-blue/5"
      >
        <FolderPlus size={14} /> New folder
      </button>
    )
  }

  return (
    <div className="rounded-2xl border bg-white p-3 space-y-2">
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Folder name (e.g. Bursary Information)"
          className="flex-1 px-3 py-2 border rounded-lg text-sm"
          onKeyDown={e => { if (e.key === 'Enter') submit() }}
        />
        <button onClick={() => setOpen(false)} className="p-2 rounded-lg hover:bg-gray-100" aria-label="Close">
          <X size={14} />
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        onClick={submit}
        disabled={submitting}
        className="w-full rounded-xl bg-gradient-to-r from-tranmere-blue to-blue-700 text-white px-4 py-2.5 text-sm font-semibold shadow disabled:opacity-50"
      >
        {submitting ? 'Creating…' : 'Create folder'}
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- __tests__/components/documents/CreateFolderButton.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add app/documents/CreateFolderButton.tsx __tests__/components/documents/CreateFolderButton.test.tsx
git commit -m "feat: add CreateFolderButton component"
```

---

### Task 4: Folder list page

**Files:**
- Create: `app/documents/page.tsx`

**Interfaces:**
- Consumes: `CreateFolderButton` (Task 3).
- Produces: the `/documents` route. No other task consumes this file directly.

- [ ] **Step 1: Write `app/documents/page.tsx`**

```tsx
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

      {(folders ?? []).length === 0 && (
        <div className="rounded-2xl border bg-white p-8 text-center text-sm text-muted-foreground">
          No folders yet.
        </div>
      )}

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
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors from `app/documents/page.tsx`. No Jest test for this
file — server component/page, matches this codebase's existing convention
(the chat hub's `app/chat/page.tsx` has no test either).

- [ ] **Step 3: Commit**

```bash
git add app/documents/page.tsx
git commit -m "feat: add document folder list page"
```

---

### Task 5: `UploadDropzone` component

**Files:**
- Create: `app/documents/UploadDropzone.tsx`
- Test: `__tests__/components/documents/UploadDropzone.test.tsx`

**Interfaces:**
- Consumes: `recordDocument` from `./actions` (Task 2); `createClient` from `@/lib/supabase/client` (browser client, already used the same way in `app/chat/[roomId]/ChatThread.tsx`'s `uploadAttachment`).
- Produces: `UploadDropzone({ folderId: string })`. Consumed by Task 7 (`app/documents/[folderId]/page.tsx`).

- [ ] **Step 1: Write the failing test**

Create `__tests__/components/documents/UploadDropzone.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { UploadDropzone } from '@/app/documents/UploadDropzone'

const refreshMock = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: refreshMock }) }))

const recordDocumentMock = jest.fn()
jest.mock('@/app/documents/actions', () => ({
  recordDocument: (...args: any[]) => recordDocumentMock(...args),
}))

const uploadMock = jest.fn()
jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    storage: { from: () => ({ upload: (...args: any[]) => uploadMock(...args) }) },
  }),
}))

function makeFile(name: string, type: string, size: number): File {
  const file = new File(['x'], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

describe('UploadDropzone', () => {
  beforeEach(() => {
    refreshMock.mockClear()
    recordDocumentMock.mockReset()
    uploadMock.mockReset()
  })

  it('rejects a disallowed file type without uploading', async () => {
    render(<UploadDropzone folderId="f1" />)
    const input = screen.getByLabelText('Upload files')
    const file = makeFile('virus.exe', 'application/x-msdownload', 1000)
    fireEvent.change(input, { target: { files: [file] } })
    expect(await screen.findByText('File type not allowed')).toBeInTheDocument()
    expect(uploadMock).not.toHaveBeenCalled()
  })

  it('rejects an over-size file without uploading', async () => {
    render(<UploadDropzone folderId="f1" />)
    const input = screen.getByLabelText('Upload files')
    const file = makeFile('big.pdf', 'application/pdf', 25 * 1024 * 1024)
    fireEvent.change(input, { target: { files: [file] } })
    expect(await screen.findByText('File is larger than 20MB')).toBeInTheDocument()
    expect(uploadMock).not.toHaveBeenCalled()
  })

  it('uploads a valid file and records it, then refreshes', async () => {
    uploadMock.mockResolvedValue({ error: null })
    recordDocumentMock.mockResolvedValue({ ok: true })
    render(<UploadDropzone folderId="f1" />)
    const input = screen.getByLabelText('Upload files')
    const file = makeFile('handbook.pdf', 'application/pdf', 1000)
    fireEvent.change(input, { target: { files: [file] } })
    await waitFor(() => expect(uploadMock).toHaveBeenCalled())
    await waitFor(() => expect(recordDocumentMock).toHaveBeenCalledWith('f1', expect.stringContaining('handbook.pdf'), 'handbook.pdf', 'application/pdf', 1000))
    await waitFor(() => expect(refreshMock).toHaveBeenCalled())
  })

  it('shows an error and does not record when the storage upload fails', async () => {
    uploadMock.mockResolvedValue({ error: { message: 'Network error' } })
    render(<UploadDropzone folderId="f1" />)
    const input = screen.getByLabelText('Upload files')
    const file = makeFile('handbook.pdf', 'application/pdf', 1000)
    fireEvent.change(input, { target: { files: [file] } })
    expect(await screen.findByText('Network error')).toBeInTheDocument()
    expect(recordDocumentMock).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- __tests__/components/documents/UploadDropzone.test.tsx`
Expected: FAIL with "Cannot find module '@/app/documents/UploadDropzone'"

- [ ] **Step 3: Write `app/documents/UploadDropzone.tsx`**

```tsx
'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { UploadCloud, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { recordDocument } from './actions'

// Mirrors the allowed_mime_types/file_size_limit on the 'documents' bucket
// (supabase/migrations/045_documents.sql) — client-side check is UX only,
// the bucket's own RLS + limits are the actual enforcement.
const ALLOWED_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
])
const MAX_SIZE_BYTES = 20 * 1024 * 1024

type UploadState = { file: File; status: 'uploading' | 'error'; error?: string }

export function UploadDropzone({ folderId }: { folderId: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [dragOver, setDragOver] = useState(false)
  const [uploads, setUploads] = useState<UploadState[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  function validate(file: File): string | null {
    if (!ALLOWED_TYPES.has(file.type)) return 'File type not allowed'
    if (file.size > MAX_SIZE_BYTES) return 'File is larger than 20MB'
    return null
  }

  async function uploadOne(file: File) {
    const validationError = validate(file)
    if (validationError) {
      setUploads(prev => [...prev, { file, status: 'error', error: validationError }])
      return
    }
    setUploads(prev => [...prev, { file, status: 'uploading' }])

    const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `${folderId}/${crypto.randomUUID()}-${sanitized}`

    const { error: uploadError } = await supabase.storage.from('documents').upload(path, file)
    if (uploadError) {
      setUploads(prev => prev.map(u => u.file === file ? { ...u, status: 'error', error: uploadError.message } : u))
      return
    }

    const res = await recordDocument(folderId, path, file.name, file.type, file.size)
    if (!res.ok) {
      setUploads(prev => prev.map(u => u.file === file ? { ...u, status: 'error', error: res.error ?? 'Failed to save' } : u))
      return
    }

    setUploads(prev => prev.filter(u => u.file !== file))
    router.refresh()
  }

  function handleFiles(files: FileList | null) {
    if (!files) return
    Array.from(files).forEach(uploadOne)
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    handleFiles(e.dataTransfer.files)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folderId])

  return (
    <div className="space-y-2">
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
          dragOver ? 'border-tranmere-blue bg-tranmere-blue/5' : 'border-gray-300 hover:border-tranmere-blue/50'
        }`}
      >
        <UploadCloud size={24} className="text-tranmere-blue" />
        <p className="text-sm font-medium">Drag files here, or click to browse</p>
        <p className="text-xs text-muted-foreground">PDF, Word, Excel, JPG, PNG — up to 20MB</p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
          aria-label="Upload files"
          className="hidden"
          onChange={e => { handleFiles(e.target.files); e.target.value = '' }}
        />
      </div>

      {uploads.length > 0 && (
        <div className="space-y-1">
          {uploads.map((u, i) => (
            <div key={i} className="flex items-center gap-2 text-xs rounded-lg border px-3 py-2">
              <span className="flex-1 truncate">{u.file.name}</span>
              {u.status === 'uploading' && <span className="text-muted-foreground">Uploading…</span>}
              {u.status === 'error' && <span className="text-red-600">{u.error}</span>}
              <button onClick={() => setUploads(prev => prev.filter((_, j) => j !== i))} aria-label="Dismiss" className="text-gray-400 hover:text-gray-600">
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

Note: multi-file drag/drop is handled by `Array.from(files).forEach(uploadOne)`
— each file runs through the same independent validate→upload→record path,
so dropping several files at once "just works" without extra code; not
given its own dedicated test (the per-file logic is already fully covered
above) to keep the suite focused.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- __tests__/components/documents/UploadDropzone.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add app/documents/UploadDropzone.tsx __tests__/components/documents/UploadDropzone.test.tsx
git commit -m "feat: add UploadDropzone component"
```

---

### Task 6: `DocumentList` component

**Files:**
- Create: `app/documents/[folderId]/DocumentList.tsx`
- Test: `__tests__/components/documents/DocumentList.test.tsx`

**Interfaces:**
- Consumes: `deleteDocument` from `../actions` (Task 2).
- Produces: `DocumentList({ documents, isStaff })`, where
  `documents: { id: string; name: string; mime_type: string; size_bytes: number; url: string | null }[]`
  and `isStaff: boolean`. Consumed by Task 7 (`app/documents/[folderId]/page.tsx`).

- [ ] **Step 1: Write the failing test**

Create `__tests__/components/documents/DocumentList.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { DocumentList } from '@/app/documents/[folderId]/DocumentList'

const refreshMock = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: refreshMock }) }))

const deleteDocumentMock = jest.fn()
jest.mock('@/app/documents/actions', () => ({
  deleteDocument: (...args: any[]) => deleteDocumentMock(...args),
}))

const docs = [
  { id: 'd1', name: 'Handbook.pdf', mime_type: 'application/pdf', size_bytes: 204800, url: 'https://example.com/handbook.pdf' },
  { id: 'd2', name: 'Logo.png', mime_type: 'image/png', size_bytes: 5000, url: null },
]

describe('DocumentList', () => {
  beforeEach(() => {
    refreshMock.mockClear()
    deleteDocumentMock.mockReset()
  })

  it('renders file names and sizes', () => {
    render(<DocumentList documents={docs} isStaff={false} />)
    expect(screen.getByText('Handbook.pdf')).toBeInTheDocument()
    expect(screen.getByText('200 KB')).toBeInTheDocument()
  })

  it('shows a download link only when a url is available', () => {
    render(<DocumentList documents={docs} isStaff={false} />)
    expect(screen.getByLabelText('Download Handbook.pdf')).toBeInTheDocument()
    expect(screen.queryByLabelText('Download Logo.png')).not.toBeInTheDocument()
  })

  it('shows no delete controls for a non-staff viewer', () => {
    render(<DocumentList documents={docs} isStaff={false} />)
    expect(screen.queryByLabelText(/Delete/)).not.toBeInTheDocument()
  })

  it('shows delete controls for staff and calls deleteDocument on confirm', () => {
    window.confirm = jest.fn(() => true)
    deleteDocumentMock.mockResolvedValue({ ok: true })
    render(<DocumentList documents={docs} isStaff={true} />)
    fireEvent.click(screen.getByLabelText('Delete Handbook.pdf'))
    expect(deleteDocumentMock).toHaveBeenCalledWith('d1')
  })

  it('renders an empty state when there are no files', () => {
    render(<DocumentList documents={[]} isStaff={false} />)
    expect(screen.getByText('No files in this folder yet.')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- __tests__/components/documents/DocumentList.test.tsx`
Expected: FAIL with "Cannot find module '@/app/documents/[folderId]/DocumentList'"

- [ ] **Step 3: Write `app/documents/[folderId]/DocumentList.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, FileSpreadsheet, FileImage, File as FileIcon, Trash2, Download } from 'lucide-react'
import { deleteDocument } from '../actions'

type Doc = {
  id: string
  name: string
  mime_type: string
  size_bytes: number
  url: string | null
}

function iconFor(mimeType: string) {
  if (mimeType === 'application/pdf') return FileText
  if (mimeType.includes('word')) return FileText
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return FileSpreadsheet
  if (mimeType.startsWith('image/')) return FileImage
  return FileIcon
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function DocumentList({ documents, isStaff }: { documents: Doc[]; isStaff: boolean }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    setError(null)
    setRemovingId(id)
    start(async () => {
      const res = await deleteDocument(id)
      setRemovingId(null)
      if (res.ok) router.refresh()
      else setError(res.error ?? 'Failed to delete')
    })
  }

  if (documents.length === 0) {
    return <p className="text-center text-xs text-muted-foreground py-8">No files in this folder yet.</p>
  }

  return (
    <div className="rounded-2xl border bg-white divide-y">
      {error && <p className="text-xs text-red-600 px-3 py-2">{error}</p>}
      {documents.map(doc => {
        const Icon = iconFor(doc.mime_type)
        return (
          <div key={doc.id} className="flex items-center gap-3 p-3">
            <div className="w-10 h-10 rounded-lg bg-tranmere-blue/10 flex items-center justify-center text-tranmere-blue shrink-0">
              <Icon size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{doc.name}</p>
              <p className="text-xs text-muted-foreground">{formatSize(doc.size_bytes)}</p>
            </div>
            {doc.url && (
              <a href={doc.url} target="_blank" rel="noreferrer" aria-label={`Download ${doc.name}`}
                className="p-2 rounded-lg text-tranmere-blue hover:bg-tranmere-blue/10 shrink-0">
                <Download size={16} />
              </a>
            )}
            {isStaff && (
              <button
                onClick={() => handleDelete(doc.id, doc.name)}
                disabled={pending && removingId === doc.id}
                aria-label={`Delete ${doc.name}`}
                className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 shrink-0 disabled:opacity-50"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- __tests__/components/documents/DocumentList.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add app/documents/[folderId]/DocumentList.tsx __tests__/components/documents/DocumentList.test.tsx
git commit -m "feat: add DocumentList component"
```

---

### Task 7: Folder detail page — wire UploadDropzone + DocumentList

**Files:**
- Create: `app/documents/[folderId]/page.tsx`

**Interfaces:**
- Consumes: `UploadDropzone` (Task 5), `DocumentList` (Task 6).
- Produces: the `/documents/[folderId]` route.

- [ ] **Step 1: Write `app/documents/[folderId]/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { UploadDropzone } from '../UploadDropzone'
import { DocumentList } from './DocumentList'

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
      </div>

      {isStaff && <UploadDropzone folderId={params.folderId} />}

      <DocumentList documents={documents} isStaff={isStaff} />
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors from `app/documents/[folderId]/page.tsx`.

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: PASS — every test from Tasks 3, 5, 6 plus the pre-existing suite
all green.

- [ ] **Step 4: Commit**

```bash
git add app/documents/[folderId]/page.tsx
git commit -m "feat: wire UploadDropzone/DocumentList into the folder detail page"
```

---

### Task 8: Navigation — add "Documents" to all 6 nav arrays

**Files:**
- Modify: `components/layout/SideNav.tsx`
- Modify: `components/layout/BottomNav.tsx`
- Modify: `components/layout/AdminSidebar.tsx`
- Modify: `components/layout/MobileAdminBar.tsx`
- Modify: `components/layout/ParentSidebar.tsx`
- Modify: `components/layout/MobileParentBar.tsx`

**Interfaces:**
- Consumes: nothing new — purely adds a `{ href: '/documents', label: 'Documents', icon: FolderOpen }` entry to each file's existing hardcoded `nav` array.
- Produces: nothing later depends on.

- [ ] **Step 1: `components/layout/SideNav.tsx`**

Change:

```tsx
import { Home, GraduationCap, Apple, Dumbbell, Trophy, User, LogOut, Activity, MessageSquare, Brain } from 'lucide-react'
import Image from 'next/image'
import { signOut } from '@/app/(auth)/login/actions'
import { MOODLE_STUDENT_URL } from '@/lib/config/moodle'

const nav = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: MOODLE_STUDENT_URL, label: 'Moodle', icon: GraduationCap, external: true },
```

to:

```tsx
import { Home, GraduationCap, Apple, Dumbbell, Trophy, User, LogOut, Activity, MessageSquare, Brain, FolderOpen } from 'lucide-react'
import Image from 'next/image'
import { signOut } from '@/app/(auth)/login/actions'
import { MOODLE_STUDENT_URL } from '@/lib/config/moodle'

const nav = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/documents', label: 'Documents', icon: FolderOpen },
  { href: MOODLE_STUDENT_URL, label: 'Moodle', icon: GraduationCap, external: true },
```

- [ ] **Step 2: `components/layout/BottomNav.tsx`**

Change:

```tsx
import { Home, User, Heart, CalendarDays, Dumbbell, Target } from 'lucide-react'

const nav = [
  { href: '/dashboard',  label: 'Home',      icon: Home },
  { href: '/calendar',   label: 'Calendar',  icon: CalendarDays },
```

to:

```tsx
import { Home, User, Heart, CalendarDays, Dumbbell, Target, FolderOpen } from 'lucide-react'

const nav = [
  { href: '/dashboard',  label: 'Home',      icon: Home },
  { href: '/documents',  label: 'Documents', icon: FolderOpen },
  { href: '/calendar',   label: 'Calendar',  icon: CalendarDays },
```

- [ ] **Step 3: `components/layout/AdminSidebar.tsx`**

Change:

```tsx
import { Users, Bell, BarChart2, GraduationCap, LogOut, Calendar, CalendarDays, Wifi, Activity, LayoutGrid, Plug, MessageSquare, Megaphone, Home, ClipboardList, ShieldAlert, Network, UserPlus, Users2, Banknote } from 'lucide-react'
import Image from 'next/image'
import { signOut } from '@/app/(auth)/login/actions'
import { MOODLE_TEACHER_URL } from '@/lib/config/moodle'

const nav = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: Home },
  { href: '/admin/calendar', label: 'Calendar', icon: CalendarDays },
```

to:

```tsx
import { Users, Bell, BarChart2, GraduationCap, LogOut, Calendar, CalendarDays, Wifi, Activity, LayoutGrid, Plug, MessageSquare, Megaphone, Home, ClipboardList, ShieldAlert, Network, UserPlus, Users2, Banknote, FolderOpen } from 'lucide-react'
import Image from 'next/image'
import { signOut } from '@/app/(auth)/login/actions'
import { MOODLE_TEACHER_URL } from '@/lib/config/moodle'

const nav = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: Home },
  { href: '/documents', label: 'Documents', icon: FolderOpen },
  { href: '/admin/calendar', label: 'Calendar', icon: CalendarDays },
```

- [ ] **Step 4: `components/layout/MobileAdminBar.tsx`**

Change:

```tsx
import { X, Users, Bell, BarChart2, GraduationCap, LogOut, Calendar, CalendarDays, Wifi, Activity, LayoutGrid, Plug, MessageSquare, Megaphone, Home, MoreHorizontal, ClipboardList, ShieldAlert, Network, UserPlus, Users2, Banknote } from 'lucide-react'
import { signOut } from '@/app/(auth)/login/actions'
import { MOODLE_TEACHER_URL } from '@/lib/config/moodle'

const nav = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: Home },
  { href: '/admin/calendar', label: 'Calendar', icon: CalendarDays },
```

to:

```tsx
import { X, Users, Bell, BarChart2, GraduationCap, LogOut, Calendar, CalendarDays, Wifi, Activity, LayoutGrid, Plug, MessageSquare, Megaphone, Home, MoreHorizontal, ClipboardList, ShieldAlert, Network, UserPlus, Users2, Banknote, FolderOpen } from 'lucide-react'
import { signOut } from '@/app/(auth)/login/actions'
import { MOODLE_TEACHER_URL } from '@/lib/config/moodle'

const nav = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: Home },
  { href: '/documents', label: 'Documents', icon: FolderOpen },
  { href: '/admin/calendar', label: 'Calendar', icon: CalendarDays },
```

(This only adds the entry to the drawer's full `nav` array — `MobileAdminBar`'s
persistent 5-icon bottom tab bar, rendered separately further down the same
file, is untouched. Staff reach Documents via the "More" drawer, same as
most of that array's 17 entries today.)

- [ ] **Step 5: `components/layout/ParentSidebar.tsx`**

Change:

```tsx
import { Home, ClipboardList, GraduationCap, Calendar, CalendarDays, MessageSquare, Megaphone, LogOut } from 'lucide-react'
import Image from 'next/image'
import { signOut } from '@/app/(auth)/login/actions'
import { MOODLE_STUDENT_URL } from '@/lib/config/moodle'

const nav = [
  { href: '/parent/dashboard', label: 'Overview', icon: Home },
  { href: '/parent/calendar', label: 'Calendar', icon: CalendarDays },
```

to:

```tsx
import { Home, ClipboardList, GraduationCap, Calendar, CalendarDays, MessageSquare, Megaphone, LogOut, FolderOpen } from 'lucide-react'
import Image from 'next/image'
import { signOut } from '@/app/(auth)/login/actions'
import { MOODLE_STUDENT_URL } from '@/lib/config/moodle'

const nav = [
  { href: '/parent/dashboard', label: 'Overview', icon: Home },
  { href: '/documents', label: 'Documents', icon: FolderOpen },
  { href: '/parent/calendar', label: 'Calendar', icon: CalendarDays },
```

- [ ] **Step 6: `components/layout/MobileParentBar.tsx`**

Change:

```tsx
import { Home, ClipboardList, GraduationCap, Calendar, CalendarDays, MessageSquare, Megaphone } from 'lucide-react'
import { MOODLE_STUDENT_URL } from '@/lib/config/moodle'

const nav = [
  { href: '/parent/dashboard', label: 'Overview', icon: Home },
  { href: '/parent/calendar', label: 'Calendar', icon: CalendarDays },
```

to:

```tsx
import { Home, ClipboardList, GraduationCap, Calendar, CalendarDays, MessageSquare, Megaphone, FolderOpen } from 'lucide-react'
import { MOODLE_STUDENT_URL } from '@/lib/config/moodle'

const nav = [
  { href: '/parent/dashboard', label: 'Overview', icon: Home },
  { href: '/documents', label: 'Documents', icon: FolderOpen },
  { href: '/parent/calendar', label: 'Calendar', icon: CalendarDays },
```

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors from any of the 6 modified files.

- [ ] **Step 8: Run the full test suite**

Run: `npm test`
Expected: PASS — no existing test asserts an exact nav item count or list
(none of these 6 files have their own test file today), so this purely
additive change should not break anything.

- [ ] **Step 9: Commit**

```bash
git add components/layout/SideNav.tsx components/layout/BottomNav.tsx components/layout/AdminSidebar.tsx components/layout/MobileAdminBar.tsx components/layout/ParentSidebar.tsx components/layout/MobileParentBar.tsx
git commit -m "feat: add Documents to all role navigation menus"
```

- [ ] **Step 10: Manual migration reminder**

This is a manual step, not automatable from this session:

1. Open the Supabase SQL Editor for this project.
2. Run `supabase/migrations/045_documents.sql` (written in Task 1).
3. Confirm the `documents` bucket exists: check Storage → Buckets in the
   Supabase dashboard, or `select * from storage.buckets where id =
   'documents';`.
4. In the deployed app, log in as staff: confirm "Documents" appears in
   the nav, create a folder, drag-and-drop a PDF into it, confirm it
   appears in the file list with a working download link.
5. Log in as a student or parent: confirm they see the same folder and
   file with a download link, but no "New folder", upload zone, or delete
   controls anywhere.

---

## Self-Review Notes

- **Spec coverage:** every section of
  `docs/superpowers/specs/2026-08-21-document-repository-design.md` maps
  to a task — data model + bucket (Task 1), server actions (Task 2),
  create-folder UI (Tasks 3–4), upload UI (Task 5), file list + delete UI
  (Tasks 6–7), navigation (Task 8).
- **Deviation from the spec, called out:** the spec's testing section
  listed "hides entirely for a non-staff viewer" as an `UploadDropzone`
  test. Task 5 doesn't give `UploadDropzone` an `isStaff` prop at all —
  visibility is gated entirely by its parent (`{isStaff &&
  <UploadDropzone .../>}` in Task 7's page), the same pattern this
  codebase already uses for `AddGroupMembers` in the group-chat feature.
  A self-gating prop would be redundant with that and untestable in a way
  that matters (the component simply never mounts for a non-staff viewer).
- **Type consistency:** the `Doc` shape `DocumentList` expects
  (`id, name, mime_type, size_bytes, url`) exactly matches what Task 7's
  page constructs from the `documents` table query + signed URL
  resolution. `UploadDropzone`'s `recordDocument` call
  (`folderId, path, file.name, file.type, file.size`) matches Task 2's
  `recordDocument(folderId: string, storagePath: string, name: string,
  mimeType: string, sizeBytes: number)` signature positionally and by
  type. Action return shapes (`string | { error }` for `createFolder`;
  `{ ok, error? }` for the other three) match the `createGroupChat` /
  `addGroupMembers` conventions from the group-chat feature exactly, so
  this plan's UI code can pattern-match the same way `NewGroupPicker`
  already does.
