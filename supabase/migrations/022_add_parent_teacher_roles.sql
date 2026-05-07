-- Migration 022: Add 'parent' and 'teacher' to the users role constraint
-- Run in Supabase SQL Editor

-- Drop old constraint and add the extended one
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('student', 'coach', 'admin', 'teacher', 'parent'));
