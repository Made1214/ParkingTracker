begin;
select plan(5);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
insert into public.events (id, group_id, title, starts_at, ends_at, status, created_by)
values ('90000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
  'RSVP regression', now() + interval '1 day', now() + interval '2 days', 'published', '00000000-0000-0000-0000-000000000001');
select lives_ok($$insert into public.event_attendance (group_id, event_id, user_id, status)
values ('10000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001',
 '00000000-0000-0000-0000-000000000001', 'going')$$, 'can RSVP to upcoming published event');
select lives_ok($$update public.event_attendance set status = 'maybe' where event_id = '90000000-0000-0000-0000-000000000001'$$, 'can change RSVP before start');
reset role;
update public.events set starts_at = now() - interval '1 hour' where id = '90000000-0000-0000-0000-000000000001';
set local role authenticated;
select throws_ok($$update public.event_attendance set status = 'declined' where event_id = '90000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'cannot change RSVP after start');
reset role;
update public.events set starts_at = now() + interval '1 day', status = 'cancelled' where id = '90000000-0000-0000-0000-000000000001';
set local role authenticated;
select throws_ok($$update public.event_attendance set status = 'declined' where event_id = '90000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'cannot change RSVP for cancelled event');
select throws_ok($$update public.event_attendance set event_id = '20000000-0000-0000-0000-000000000001' where event_id = '90000000-0000-0000-0000-000000000001'$$,
  '23514', 'attendance identity is immutable', 'response cannot move between events');
select * from finish();
rollback;
