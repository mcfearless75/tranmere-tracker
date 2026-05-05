-- Run in Supabase Dashboard → SQL Editor
-- Creates storage bucket for attendance selfies

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'attendance-selfies',
  'attendance-selfies',
  false,
  2097152,  -- 2 MB max per selfie
  ARRAY['image/jpeg','image/webp','image/png']
)
ON CONFLICT (id) DO NOTHING;

-- Staff can read all selfies; students can upload their own
CREATE POLICY "staff read selfies"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'attendance-selfies'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin','coach')
    )
  );

CREATE POLICY "students upload own selfie"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'attendance-selfies'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
