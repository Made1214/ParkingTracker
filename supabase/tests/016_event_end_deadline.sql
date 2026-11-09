begin;
select plan(6);
insert into public.events(id, group_id, title, starts_at, ends_at, status, created_by)
values ('90000000-0000-0000-0000-000000000016', '10000000-0000-0000-0000-000000000001',
  'Awaiting cron', now() - interval '2 hours', now() - interval '1 hour', 'published', '00000000-0000-0000-0000-000000000002');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select public.create_poll('90000000-0000-0000-0000-000000000016', 'Question', array['A','B'], false, now() + interval '1 day')$$, '55000', null, 'elapsed event rejects polls before cron');
select throws_ok($$select public.create_activity_proposal('90000000-0000-0000-0000-000000000016', 'Idea', '')$$, '55000', null, 'elapsed event rejects proposals before cron');
select throws_ok($$insert into public.tasks(group_id,event_id,title,created_by) values ('10000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000016','Late task','00000000-0000-0000-0000-000000000002')$$, '42501', null, 'elapsed event rejects tasks before cron');
select throws_ok($$select public.create_poll('20000000-0000-0000-0000-000000000002', 'Question', array['A','B'], false, now() + interval '1 day')$$, '55000', null, 'draft rejects polls');
select throws_ok($$select public.create_activity_proposal('20000000-0000-0000-0000-000000000002', 'Idea', '')$$, '55000', null, 'draft rejects proposals');
select throws_ok($$insert into public.tasks(group_id,event_id,title,created_by) values ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','Draft task','00000000-0000-0000-0000-000000000002')$$, '42501', null, 'draft rejects tasks');
select * from finish();
rollback;
