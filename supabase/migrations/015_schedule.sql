-- Weekly schedule template for auto-generating attendance sessions

CREATE TABLE IF NOT EXISTS schedule_templates (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        text NOT NULL DEFAULT 'Weekly Schedule',
  created_by  uuid REFERENCES public.users(id),
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS schedule_slots (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id  uuid NOT NULL REFERENCES schedule_templates(id) ON DELETE CASCADE,
  day_of_week  int NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sun,1=Mon...6=Sat
  time_slot    text NOT NULL CHECK (time_slot IN ('am','pm')),
  session_type text NOT NULL CHECK (session_type IN ('training','lessons','match','gym')),
  session_label text NOT NULL,
  UNIQUE (template_id, day_of_week, time_slot)
);

ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS scheduled_date date;

ALTER TABLE schedule_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_slots     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff manage schedule_templates"
  ON schedule_templates FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin','coach')));

CREATE POLICY "staff manage schedule_slots"
  ON schedule_slots FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin','coach')));
