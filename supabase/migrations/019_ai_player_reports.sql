-- Cached AI development reports — one per student, refreshed daily
CREATE TABLE IF NOT EXISTS ai_player_reports (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  generated_at  timestamptz NOT NULL DEFAULT now(),
  report_json   jsonb NOT NULL,
  CONSTRAINT uq_ai_report_per_student UNIQUE (student_id)
);

ALTER TABLE ai_player_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "students read own report"
  ON ai_player_reports FOR SELECT
  USING (student_id = auth.uid());

CREATE POLICY "service role full access"
  ON ai_player_reports FOR ALL
  USING (auth.role() = 'service_role');
