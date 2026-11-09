begin;
select plan(3);

-- Bruno owns the event; Carla is another member, and Ana is an admin.
insert into public.events (id, group_id, title, starts_at, ends_at, status, created_by)
values ('90000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000001',
  'Event permissions', now() + interval '1 day', now() + interval '2 days',
  'published', '00000000-0000-0000-0000-000000000002');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select is_empty($$update public.events set title = 'unauthorized' where id = '90000000-0000-0000-0000-000000000011' returning id$$,
  'another member cannot update the event');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select results_eq($$update public.events set title = 'updated by creator' where id = '90000000-0000-0000-0000-000000000011' returning title$$,
  $$values ('updated by creator'::text)$$, 'creator can update the event');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select results_eq($$update public.events set status = 'cancelled' where id = '90000000-0000-0000-0000-000000000011' returning status::text$$,
  $$values ('cancelled'::text)$$, 'group admin can cancel the event');

select * from finish();
rollback;
