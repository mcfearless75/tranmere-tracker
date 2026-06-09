-- 032_year_group.sql
-- Distinguish first-year vs second-year students across squad lists.
-- year_group: 1 = first year, 2 = second year. New intake defaults to 1.

alter table public.users
  add column if not exists year_group smallint not null default 1;

alter table public.users
  drop constraint if exists users_year_group_check;
alter table public.users
  add constraint users_year_group_check check (year_group in (1, 2));

-- Backfill: existing students are 2nd year, except Caleb McWilliam (1st year).
update public.users set year_group = 2 where role = 'student';
update public.users set year_group = 1
  where id = '8e230c3a-a84e-426f-a176-42d310d5f14e';
