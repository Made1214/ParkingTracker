begin;
select plan(7);

-- Prepara un grupo con más filas que el límite de PostgREST y dos salidas pasadas.
insert into public.groups (id, name, invite_code, created_by)
values ('35000000-0000-0000-0000-000000000001', 'Agregados', 'TEST0350',
  '00000000-0000-0000-0000-000000000001');
insert into public.group_members (group_id, user_id, role, joined_at) values
  ('35000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
   'admin', now() - interval '10 days'),
  ('35000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002',
   'member', now() - interval '2 days');
insert into public.events (group_id, title, starts_at, ends_at)
select '35000000-0000-0000-0000-000000000001', 'Borrador ' || i, now(), now() + interval '1 hour'
from generate_series(1, 1001) i;
insert into public.events (id, group_id, title, starts_at, ends_at, status) values
  ('35000000-0000-0000-0000-000000000011', '35000000-0000-0000-0000-000000000001',
   'Pasada A', now() - interval '4 days', now() - interval '3 days', 'finished'),
  ('35000000-0000-0000-0000-000000000012', '35000000-0000-0000-0000-000000000001',
   'Pasada B', now() - interval '1 day', now() - interval '12 hours', 'published');
insert into public.event_attendance (group_id, event_id, user_id, status) values
  ('35000000-0000-0000-0000-000000000001', '35000000-0000-0000-0000-000000000011',
   '00000000-0000-0000-0000-000000000001', 'going'),
  ('35000000-0000-0000-0000-000000000001', '35000000-0000-0000-0000-000000000012',
   '00000000-0000-0000-0000-000000000002', 'going');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select is((select drafts from public.get_group_event_counts('35000000-0000-0000-0000-000000000001')),
  1001::bigint, 'draft totals include rows beyond the API response cap');
select is((select finished from public.get_group_event_counts('35000000-0000-0000-0000-000000000001')),
  2::bigint, 'an ended published event counts as finished');
select is(jsonb_array_length(public.get_group_stats('35000000-0000-0000-0000-000000000001')->'history'),
  2, 'drafts are excluded from history');
select is(public.get_group_stats('35000000-0000-0000-0000-000000000001')->>'averageAttendance',
  '67', 'attendance is weighted by eligible member and event combinations');
select is((select events_invited from public.member_participation
  where group_id = '35000000-0000-0000-0000-000000000001' and user_id = '00000000-0000-0000-0000-000000000002'),
  1::bigint, 'members are excluded from events before they joined');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000006","role":"authenticated"}', true);
select is(public.get_group_stats('35000000-0000-0000-0000-000000000001'), null::jsonb,
  'stats do not reveal another group');
select is((select drafts from public.get_group_event_counts('35000000-0000-0000-0000-000000000001')),
  0::bigint, 'event totals respect RLS');

select * from finish();
rollback;
