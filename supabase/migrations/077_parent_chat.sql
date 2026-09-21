alter table public.chat_rooms drop constraint if exists chat_rooms_kind_check;
alter table public.chat_rooms
  add constraint chat_rooms_kind_check
  check (kind in ('dm','squad','match','broadcast','bot','custom','parent'));

insert into public.chat_rooms (kind, name)
select 'parent', 'Parents'
where not exists (select 1 from public.chat_rooms where kind = 'parent' and name = 'Parents');

insert into public.chat_members (room_id, user_id, role)
select r.id, u.id, 'member'
from public.chat_rooms r
cross join public.users u
where r.kind = 'parent'
  and u.role in ('admin', 'coach', 'teacher', 'parent')
  and u.is_active is distinct from false
on conflict (room_id, user_id) do nothing;
