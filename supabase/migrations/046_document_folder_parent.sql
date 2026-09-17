-- Nested folders: a folder may live inside another folder.
alter table public.document_folders
  add column if not exists parent_id uuid references public.document_folders(id) on delete cascade;

create index if not exists document_folders_parent_id_idx
  on public.document_folders (parent_id);
