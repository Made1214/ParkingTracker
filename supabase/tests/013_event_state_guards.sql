begin;
select plan(5);
insert into public.events(id, group_id, title, starts_at, ends_at, status, created_by)
values ('90000000-0000-0000-0000-000000000013', '10000000-0000-0000-0000-000000000001',
  'Guarded', now() + interval '1 day', now() + interval '2 days', 'published',
  '00000000-0000-0000-0000-000000000002');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$update public.events set created_by = '00000000-0000-0000-0000-000000000003' where id = '90000000-0000-0000-0000-000000000013'$$,
  '23514', 'event identity is immutable', 'creator cannot transfer ownership');
select throws_ok($$update public.events set status = 'finished' where id = '90000000-0000-0000-0000-000000000013'$$,
  '23514', 'invalid event state transition', 'creator cannot mark an event finished');
select throws_ok($$insert into public.events(group_id, title, starts_at, ends_at, status, created_by)
  values ('10000000-0000-0000-0000-000000000001', 'Past', now() - interval '2 days', now() - interval '1 day', 'published', '00000000-0000-0000-0000-000000000002')$$,
  '23514', 'invalid event state', 'member cannot create past events');
select lives_ok($$update public.events set status = 'cancelled' where id = '90000000-0000-0000-0000-000000000013'$$,
  'creator can cancel a future event');
select throws_ok($$update public.events set status = 'published' where id = '90000000-0000-0000-0000-000000000013'$$,
  '23514', 'event can no longer be modified', 'cancelled events cannot be reopened');
select * from finish();
rollback;
