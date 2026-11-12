-- 030_event_cancel_reason.sql
-- events.cancel_reason: set together with the cancellation, rejected on
-- events that are not cancelled, bounded, and frozen afterwards.
begin;
select plan(5);

-- A future published event created by Ana (admin of the seed group).
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
insert into public.events (id, group_id, title, starts_at, ends_at, status, created_by)
values (
  '20000000-0000-0000-0000-0000000000c1',
  '10000000-0000-0000-0000-000000000001',
  'Salida para cancelar',
  now() + interval '3 days',
  now() + interval '3 days 4 hours',
  'published',
  '00000000-0000-0000-0000-000000000001'
);

select throws_ok(
  $$ update public.events set cancel_reason = 'Llueve'
      where id = '20000000-0000-0000-0000-0000000000c1' $$,
  '23514',
  null,
  'a reason cannot be set on an event that is not cancelled'
);

select throws_ok(
  $$ update public.events set status = 'cancelled', cancel_reason = repeat('x', 301)
      where id = '20000000-0000-0000-0000-0000000000c1' $$,
  '23514',
  null,
  'a reason longer than 300 characters is rejected'
);

select lives_ok(
  $$ update public.events set status = 'cancelled', cancel_reason = 'Pronóstico de lluvia'
      where id = '20000000-0000-0000-0000-0000000000c1' $$,
  'the reason is saved together with the cancellation'
);

select is(
  (select cancel_reason from public.events
    where id = '20000000-0000-0000-0000-0000000000c1'),
  'Pronóstico de lluvia',
  'members read the reason'
);

select throws_ok(
  $$ update public.events set cancel_reason = 'Otro motivo'
      where id = '20000000-0000-0000-0000-0000000000c1' $$,
  '23514',
  'event can no longer be modified',
  'the reason is frozen once the event is cancelled'
);

select * from finish();
rollback;
