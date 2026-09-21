-- Attendance missing is handled on Home / the register, not as DSL cases.
update public.safeguarding_concerns
set status = 'closed'
where category = 'attendance'
  and status is distinct from 'closed'
  and (
    raised_by is null
    or description ilike 'Auto-detected by the attendance system%'
  );
