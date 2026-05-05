-- Drop and recreate schedule tables with proper time support
-- Safe to run — 015_schedule.sql tables will have no data yet

DROP TABLE IF EXISTS schedule_slots;
DROP TABLE IF EXISTS schedule_templates;

CREATE TABLE schedule_templates (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        text NOT NULL DEFAULT 'Weekly Schedule',
  created_by  uuid REFERENCES public.users(id),
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE schedule_slots (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id   uuid NOT NULL REFERENCES schedule_templates(id) ON DELETE CASCADE,
  day_of_week   int  NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sun, 1=Mon … 6=Sat
  slot_order    int  NOT NULL DEFAULT 1,
  start_time    time NOT NULL,
  end_time      time NOT NULL,
  session_type  text NOT NULL CHECK (session_type IN (
    'training','lessons','match','gym','btec','gcse','tutorial','analysis'
  )),
  session_label text NOT NULL,
  UNIQUE (template_id, day_of_week, slot_order)
);

ALTER TABLE schedule_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_slots     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff manage schedule_templates"
  ON schedule_templates FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin','coach')));

CREATE POLICY "staff manage schedule_slots"
  ON schedule_slots FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin','coach')));
