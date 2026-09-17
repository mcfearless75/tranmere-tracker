-- Usual Catapult cloud codes from the TR Prem GPS clipboard (pods 16-30).
-- Safe to re-run: only fills empty catapult_code. Last-name match must be unique.

alter table public.users add column if not exists catapult_code text;

create unique index if not exists users_catapult_code_lower_idx
  on public.users (lower(catapult_code))
  where catapult_code is not null and btrim(catapult_code) <> '';

do $$
declare
  pair record;
begin
  for pair in
    select * from (values
      ('Lowther',  'Tranmere P16'),
      ('Garrett',  'Tranmere P17'),
      ('Chester',  'Tranmere P18'),
      ('Kennedy',  'Tranmere P19'),
      ('Piercy',   'Tranmere P20'),
      ('Barton',   'Tranmere P21'),
      ('McIntosh', 'Tranmere P22'),
      ('Duncan',   'Tranmere P23'),
      ('Macaulay', 'Tranmere P24'),
      ('Carey',    'Tranmere P25'),
      ('Teudde',   'Tranmere P26'),
      ('Edwards',  'Tranmere P28'),
      ('Bullock',  'Tranmere P29'),
      ('Bohe',     'Tranmere P30')
    ) as t(last_name, code)
  loop
    if (select count(*) from public.users
        where role = 'student'
          and name ilike '%' || pair.last_name || '%') = 1 then
      update public.users
      set catapult_code = pair.code
      where role = 'student'
        and name ilike '%' || pair.last_name || '%'
        and (catapult_code is null or btrim(catapult_code) = '');
    end if;
  end loop;
end $$;

update public.users
set catapult_code = 'Tranmere P27'
where role = 'student'
  and name ilike '%Caleb%McWilliam%'
  and (catapult_code is null or btrim(catapult_code) = '');
