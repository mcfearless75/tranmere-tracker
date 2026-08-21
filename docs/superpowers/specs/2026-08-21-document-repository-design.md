# Document Repository — Design

**Date:** 2026-08-21
**Status:** Approved, ready for implementation plan

## Problem

Staff currently share documents (BTEC specs, bursary info, job vacancies, the
student handbook, trip/fixture info) through an external Wix group's
"Attachments" tab — flat folders of files, outside the platform entirely.
There is no in-app equivalent: no way to organize files into named folders,
upload via drag-and-drop, or browse/download them from within Tranmere
Tracker.

## Scope decisions (from brainstorming)

- **Who manages folders/files:** admin, coach, and teacher (all staff)
  equally — same as group chat's staff-parity model.
- **Who can view/download:** everyone (students, parents, staff) — no
  per-folder visibility restriction. Simplest to start; matches how the
  Wix Attachments tab works today (one shared list for the whole group).
- **File types:** PDF, Word (`.doc`/`.docx`), Excel (`.xls`/`.xlsx`), and
  images (JPG/PNG) — covers everything implied by the existing Wix folder
  names ("Bursary Information", "Football", "Job Vacancies") without
  opening the door to arbitrary file types.
- **Folder nesting:** one flat level only — folders contain files directly,
  no folders-within-folders. Matches the Wix reference exactly; nesting
  adds breadcrumbs, recursive delete, and deeper permission checks that
  nothing in the reference UI needs.
- **Notifications:** none. Quiet, browse-when-you-need-it feature — no push
  notification on upload (unlike the calendar's day-before reminder cron).
- **Navigation:** one new shared "Documents" nav entry, visible in every
  role's nav (student desktop/mobile, parent desktop/mobile, staff
  desktop/mobile) — not an admin-only page linked from elsewhere.

## Architecture

One shared top-level route, `app/documents/`, not role-prefixed — the same
shape `app/chat/` already uses (`/chat` works identically for every role;
the page computes `isStaff` internally rather than living under
`/admin/chat`, `/parent/chat`, etc.). This avoids building three
near-identical role-prefixed copies of the same folder/file browser.

- **`app/documents/page.tsx`** (new) — folder list. Staff see a "New
  folder" control; everyone sees every folder with a file count.
- **`app/documents/[folderId]/page.tsx`** (new) — one folder's contents.
  Staff see a drag-and-drop upload zone and a delete control per file;
  everyone sees the file list with download links.

## Data model

New migration `045_documents.sql`:

```sql
create table if not exists document_folders (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  created_by  uuid references public.users(id),
  created_at  timestamptz default now()
);

create table if not exists documents (
  id            uuid primary key default uuid_generate_v4(),
  folder_id     uuid not null references document_folders(id) on delete cascade,
  name          text not null,               -- original filename, shown in UI
  storage_path  text not null,                -- path within the 'documents' bucket
  mime_type     text not null,
  size_bytes    bigint not null,
  uploaded_by   uuid references public.users(id),
  created_at    timestamptz default now()
);

create index if not exists documents_folder_id_idx on documents(folder_id);

alter table document_folders enable row level security;
alter table documents enable row level security;

-- Everyone authenticated can read — non-sensitive shared resources.
create policy "everyone can read document_folders"
  on document_folders for select using (auth.uid() is not null);
create policy "everyone can read documents"
  on documents for select using (auth.uid() is not null);

-- Staff manage both tables (create/delete folders, delete file rows).
-- Matches the existing public.is_staff() pattern used by calendar_events
-- and every other staff-write table in this app.
create policy "staff manage document_folders"
  on document_folders for all using (public.is_staff());
create policy "staff manage documents"
  on documents for all using (public.is_staff());
```

Row inserts into `documents` happen through a server action (service-role
client), not directly from the browser — see Upload flow below — so no
client-side insert policy is needed on the `documents` table itself.

**Storage bucket** (`documents`, private, 20MB/file cap, restricted MIME
types), created the same way `attendance-selfies` was in
`014_attendance_storage.sql`:

```sql
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
create policy "documents_auth_read" on storage.objects
  for select using (bucket_id = 'documents' and auth.uid() is not null);

-- Only staff can upload — matches the documents-table write policy.
create policy "documents_staff_insert" on storage.objects
  for insert with check (bucket_id = 'documents' and public.is_staff());

-- Only staff can delete objects (folder/file deletion).
create policy "documents_staff_delete" on storage.objects
  for delete using (bucket_id = 'documents' and public.is_staff());
```

This is deliberately a **new** bucket, not the existing unused `coursework`
bucket — `coursework` is a different, unrelated concept (student coursework
submissions) and reusing it would couple two features that have nothing to
do with each other.

## Upload flow

Staff-only, drag-and-drop, multi-file:

1. Client validates each dropped file against the same allow-list (type +
   20MB cap) before attempting upload — immediate feedback, not a round
   trip to find out a file is rejected.
2. For each valid file, the browser uploads directly to Supabase Storage
   (`documents` bucket) using the authenticated client — the bucket's own
   RLS (`documents_staff_insert`) is the actual enforcement; the client
   check above is just UX. Path:
   `${folderId}/${crypto.randomUUID()}-${sanitizedFileName}`.
3. On successful upload, a server action `recordDocument(folderId, path,
   name, mimeType, sizeBytes)` inserts the `documents` row — re-verifying
   the caller is staff server-side before writing, per this app's
   established "never trust the client" rule for every mutating action.
4. If the DB insert fails after a successful storage upload, the action
   deletes the just-uploaded storage object to avoid an orphaned file with
   no listing (no dangling bytes nobody can find or clean up).

## Delete flow

Staff-only. Deleting a file removes the storage object (service-role admin
client) and the `documents` row. Deleting a folder cascades: DB-level
`on delete cascade` removes all `documents` rows, but storage objects are
NOT covered by a Postgres cascade — the delete-folder server action must
first list and delete every object under `${folderId}/` in the bucket, then
delete the folder row. Confirmation prompt before folder delete, matching
the existing "leave/delete conversation" pattern in `ChatRoomActions.tsx`.

## Frontend / UI

- **`app/documents/page.tsx`**: server component, queries
  `document_folders` + a per-folder count of `documents`. Staff-only "New
  folder" button (name input, calls `createFolder`). Folder tiles link to
  `/documents/[folderId]`.
- **`app/documents/[folderId]/page.tsx`**: server component, queries the
  folder + its `documents` rows, resolves signed URLs for each file (bucket
  is private — same pattern `ChatThread.tsx` already uses for
  `chat-attachments`: `createSignedUrl`, 1 hour expiry). Renders
  `DocumentList` (file rows: type icon by `mime_type`, name, size,
  download link, staff-only delete button) and, staff-only, `UploadDropzone`
  above it.
- **`app/documents/UploadDropzone.tsx`** (new): drag-and-drop target +
  file-picker fallback, per-file progress, client-side type/size
  validation with inline error messages, multi-file support.
- **`app/documents/CreateFolderButton.tsx`** (new): same
  button-that-expands-into-a-form shape as `NewGroupPicker.tsx` — name
  input, submit, cancel.
- **Navigation**: add `{ href: '/documents', label: 'Documents', icon:
  FolderOpen }` to all 6 existing nav arrays — `SideNav.tsx`,
  `BottomNav.tsx`, `AdminSidebar.tsx`, `MobileAdminBar.tsx`,
  `ParentSidebar.tsx`, `MobileParentBar.tsx`. Purely additive, one line
  each, following each file's existing array shape exactly.

## Testing

Matches this codebase's established convention (component-level Jest
coverage; server actions and migrations verified live, not unit-tested):

- `UploadDropzone`: rejects an over-size file with an inline error and
  does not attempt upload; rejects a disallowed MIME type the same way;
  accepts multiple valid files; hides entirely for a non-staff viewer.
- `DocumentList`: renders the right icon per `mime_type`; shows a delete
  control only for staff; renders nothing destructive for a non-staff
  viewer (download links only).
- `CreateFolderButton`: same shape as the existing `NewGroupPicker` tests
  — open/validate-empty-name/submit.

## Out of scope (deliberately)

- Folder nesting (subfolders).
- Per-folder visibility restrictions (e.g. year-group-scoped folders, the
  way the two auto-synced chat rooms work) — everyone sees every folder.
- Upload notifications / push reminders.
- File versioning or edit-in-place (replace a file) — delete and
  re-upload is the only path.
- Full-text search across document contents.
- A generic "attach a document" picker inside other features (chat,
  broadcasts) — this is a standalone repository, not yet wired into
  anything else.
