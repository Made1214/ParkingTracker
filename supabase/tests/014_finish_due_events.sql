begin;
select plan(6);
insert into public.events (id, group_id, title, starts_at, ends_at, status, created_by)
select ('90000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  '10000000-0000-0000-0000-000000000001', 'Completion test',
  now() - interval '2 days', now() - interval '1 day', state::public.event_status,
  '00000000-0000-0000-0000-000000000001'
from (values (21, 'published'), (22, 'draft'), (23, 'cancelled')) as v(n, state);
insert into public.events (id, group_id, title, starts_at, ends_at, status, created_by)
values ('90000000-0000-0000-0000-000000000024', '10000000-0000-0000-0000-000000000001',
  'Future', now() + interval '1 day', now() + interval '2 days', 'published',
  '00000000-0000-0000-0000-000000000001');
select lives_ok($$select private.finish_due_events()$$, 'maintenance can complete due events');
select is((select status::text from public.events where id = '90000000-0000-0000-0000-000000000021'), 'finished', 'expired published event finishes');
select is((select status::text from public.events where id = '90000000-0000-0000-0000-000000000022'), 'draft', 'expired draft remains draft');
select is((select status::text from public.events where id = '90000000-0000-0000-0000-000000000023'), 'cancelled', 'cancelled event remains cancelled');
select is((select status::text from public.events where id = '90000000-0000-0000-0000-000000000024'), 'published', 'future event remains published');
select ok(not has_function_privilege('authenticated', 'private.finish_due_events()', 'execute'), 'members cannot invoke maintenance');
select * from finish();
rollback;
