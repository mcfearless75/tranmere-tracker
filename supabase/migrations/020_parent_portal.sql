-- Parent-to-student links
CREATE TABLE IF NOT EXISTS parent_student_links (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id   uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  student_id  uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at  timestamptz DEFAULT now(),
  CONSTRAINT uq_parent_student UNIQUE (parent_id, student_id)
);

ALTER TABLE parent_student_links ENABLE ROW LEVEL SECURITY;

-- Parents can see their own links
CREATE POLICY "parents view own links"
  ON parent_student_links FOR SELECT
  USING (parent_id = auth.uid());

-- Staff can manage all links
CREATE POLICY "staff manage parent links"
  ON parent_student_links FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin','coach','teacher'))
  );
