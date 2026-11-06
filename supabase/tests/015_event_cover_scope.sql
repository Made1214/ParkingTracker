begin;
select plan(3);
insert into public.events(id, group_id, title, starts_at, ends_at, status, created_by)
values ('90000000-0000-0000-0000-000000000015', '10000000-0000-0000-0000-000000000001',
  'Cover test', now() + interval '1 day', now() + interval '2 days', 'published', '00000000-0000-0000-0000-000000000002');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$update public.events set cover_public_id = 'events/10000000-0000-0000-0000-000000000001/90000000-0000-0000-0000-000000000015/11111111-1111-4111-8111-111111111111' where id = '90000000-0000-0000-0000-000000000015'$$, 'creator can attach an asset scoped to this event');
select throws_ok($$update public.events set cover_public_id = 'events/10000000-0000-0000-0000-000000000002/90000000-0000-0000-0000-000000000015/11111111-1111-4111-8111-111111111111' where id = '90000000-0000-0000-0000-000000000015'$$, '23514', null, 'asset from another group is rejected');
select throws_ok($$update public.events set cover_public_id = 'events/10000000-0000-0000-0000-000000000001/90000000-0000-0000-0000-000000000016/11111111-1111-4111-8111-111111111111' where id = '90000000-0000-0000-0000-000000000015'$$, '23514', null, 'asset from another event is rejected');
select * from finish();
rollback;
