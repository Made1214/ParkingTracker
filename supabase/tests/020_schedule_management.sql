begin;
select plan(11);

-- Bruno (2) organiza la salida; Carla (3) es miembro; Ana (1) es admin.
insert into public.events (id, group_id, title, starts_at, ends_at, status, created_by)
values ('90000000-0000-0000-0000-000000000021', '10000000-0000-0000-0000-000000000001',
  'Schedule test', now() + interval '1 day', now() + interval '1 day 8 hours',
  'published', '00000000-0000-0000-0000-000000000002');
insert into public.activity_proposals (id, group_id, event_id, title, status, created_by) values
  ('91000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   '90000000-0000-0000-0000-000000000021', 'Volleyball', 'accepted', '00000000-0000-0000-0000-000000000003'),
  ('91000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001',
   '90000000-0000-0000-0000-000000000021', 'Kayak', 'open', '00000000-0000-0000-0000-000000000003');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$insert into public.schedule_items (group_id, event_id, title, starts_at, created_by) values
  ('10000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000021', 'Sneaky',
   now() + interval '1 day 1 hour', '00000000-0000-0000-0000-000000000003')$$,
  '42501', null, 'a regular member cannot add activities');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select lives_ok($$insert into public.schedule_items (id, group_id, event_id, title, starts_at, ends_at, created_by) values
  ('92000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000021',
   'Salida', now() + interval '1 day', now() + interval '1 day 1 hour', '00000000-0000-0000-0000-000000000002')$$,
  'the organizer adds an activity');
select throws_ok($$insert into public.schedule_items (group_id, event_id, title, starts_at, created_by) values
  ('10000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000021', 'Too late',
   now() + interval '2 days', '00000000-0000-0000-0000-000000000002')$$,
  '23514', 'schedule item must fall within the event', 'activities must fall within the event');
select throws_ok($$insert into public.schedule_items (group_id, event_id, title, starts_at, proposal_id, created_by) values
  ('10000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000021', 'Kayak',
   now() + interval '1 day 2 hours', '91000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002')$$,
  '23514', 'only accepted proposals of this event can be scheduled', 'open proposals cannot be scheduled');
select lives_ok($$insert into public.schedule_items (group_id, event_id, title, starts_at, proposal_id, created_by) values
  ('10000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000021', 'Volleyball',
   now() + interval '1 day 3 hours', '91000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002')$$,
  'an accepted proposal becomes an activity');
select throws_ok($$insert into public.schedule_items (group_id, event_id, title, starts_at, proposal_id, created_by) values
  ('10000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000021', 'Volleyball again',
   now() + interval '1 day 4 hours', '91000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002')$$,
  '23505', null, 'a proposal is scheduled only once');
select throws_ok($$update public.schedule_items set event_id = '20000000-0000-0000-0000-000000000001'
  where id = '92000000-0000-0000-0000-000000000001'$$,
  '23514', 'schedule item identity is immutable', 'activities cannot move between events');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select is_empty($$update public.schedule_items set title = 'hijack' where id = '92000000-0000-0000-0000-000000000001' returning id$$,
  'a regular member cannot edit activities');
select results_eq($$select count(*) from public.schedule_items where event_id = '90000000-0000-0000-0000-000000000021'$$,
  $$values (2::bigint)$$, 'members can read the schedule');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select results_eq($$update public.schedule_items set title = 'Salida desde El Dorado' where id = '92000000-0000-0000-0000-000000000001' returning title$$,
  $$values ('Salida desde El Dorado'::text)$$, 'a group admin can edit activities');

reset role;
update public.events set status = 'cancelled' where id = '90000000-0000-0000-0000-000000000021';
set local role authenticated;
select is_empty($$delete from public.schedule_items where id = '92000000-0000-0000-0000-000000000001' returning id$$,
  'cancelled events lock the schedule');

select * from finish();
rollback;
