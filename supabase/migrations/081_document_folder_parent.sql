-- Renamed from 046_document_folder_parent.sql on 2026-09-21 — it collided
-- with 046_timetable.sql. 046_timetable had to keep the number because
-- 054_year1_timetable_2026_27.sql ALTERs timetable_slots; this file has no
-- dependents (047's and 058's mentions of document_folders are comments
-- only) and needs just 045_documents.sql, so it moves instead.
-- Already applied in production, so this rename is replay-only.

-- Nested folders: a folder may live inside another folder.
alter table public.document_folders
  add column if not exists parent_id uuid references public.document_folders(id) on delete cascade;

create index if not exists document_folders_parent_id_idx
  on public.document_folders (parent_id);
