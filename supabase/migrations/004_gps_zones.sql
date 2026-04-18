-- Run in Supabase SQL Editor
-- Adds speed zone columns for STATSports APEX exports

alter table gps_sessions
  add column if not exists zone1_m numeric(8,1),   -- walking   (<2 m/s)
  add column if not exists zone2_m numeric(8,1),   -- jogging   (2-4 m/s)
  add column if not exists zone3_m numeric(8,1),   -- running   (4-5.5 m/s)
  add column if not exists zone4_m numeric(8,1),   -- hsr       (5.5-7 m/s)
  add column if not exists zone5_m numeric(8,1);   -- sprinting (>7 m/s)
