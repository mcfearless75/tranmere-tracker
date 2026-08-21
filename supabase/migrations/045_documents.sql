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
  on document_folders for select to authenticated using (true);

drop policy if exists "staff manage document_folders" on document_folders;
create policy "staff manage document_folders"
  on document_folders for all using (public.is_staff());

drop policy if exists "everyone can read documents" on documents;
create policy "everyone can read documents"
  on documents for select to authenticated using (true);

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

-- Defense-in-depth only: this app's actual downloads use signed URLs minted
-- server-side with the service role (app/documents/[folderId]/page.tsx),
-- which bypasses RLS by construction and never depends on this policy. This
-- exists so a future client-side read of this bucket (if one is ever added)
-- isn't silently blocked by having no read policy at all.
drop policy if exists "documents_auth_read" on storage.objects;
create policy "documents_auth_read" on storage.objects
  for select to authenticated using (true);

-- Only staff can upload.
drop policy if exists "documents_staff_insert" on storage.objects;
create policy "documents_staff_insert" on storage.objects
  for insert with check (bucket_id = 'documents' and public.is_staff());

-- Only staff can delete objects (file/folder deletion).
drop policy if exists "documents_staff_delete" on storage.objects;
create policy "documents_staff_delete" on storage.objects
  for delete using (bucket_id = 'documents' and public.is_staff());
