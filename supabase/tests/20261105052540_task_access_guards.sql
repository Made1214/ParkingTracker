begin;
select plan(14);
insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-000000000099', 'outsider-task-test@example.com', '{"name":"Outsider"}');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$insert into public.tasks (id, group_id, event_id, title, assignee_id, created_by) values
 ('99000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Task','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002')$$, 'member creates task for member');
select throws_ok($$insert into public.tasks (group_id,event_id,title,assignee_id,created_by) values
 ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Invalid','00000000-0000-0000-0000-000000000099','00000000-0000-0000-0000-000000000002')$$, '42501', null, 'cannot assign outsider on insert');
select throws_ok($$insert into public.tasks (group_id,event_id,title,created_by) values
 ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003','Closed','00000000-0000-0000-0000-000000000002')$$, '42501', null, 'cannot insert into cancelled event');
select throws_ok($$insert into public.tasks (group_id,event_id,title,created_by) values
 ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000004','Closed','00000000-0000-0000-0000-000000000002')$$, '42501', null, 'cannot insert into finished event');
select throws_ok($$update public.tasks set assignee_id='00000000-0000-0000-0000-000000000099' where id='99000000-0000-0000-0000-000000000001'$$, '42501', null, 'cannot assign outsider on update');
select throws_ok($$update public.tasks set created_by='00000000-0000-0000-0000-000000000003' where id='99000000-0000-0000-0000-000000000001'$$, '23514', 'task identity is immutable', 'cannot transfer authorship');
select throws_ok($$update public.tasks set event_id='20000000-0000-0000-0000-000000000002' where id='99000000-0000-0000-0000-000000000001'$$, '23514', 'task identity is immutable', 'cannot move task');
select lives_ok($$update public.tasks set title='Edited', due_at=now() where id='99000000-0000-0000-0000-000000000001'$$, 'creator edits title and due date');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select lives_ok($$update public.tasks set status='in_progress', assignee_id='00000000-0000-0000-0000-000000000003' where id='99000000-0000-0000-0000-000000000001'$$, 'assignee changes status and assignment');
select throws_ok($$update public.tasks set title='Hijacked' where id='99000000-0000-0000-0000-000000000001'$$, '42501', 'assignee can only change status and assignment', 'assignee cannot edit title');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
reset role;
update public.events set status='finished' where id='20000000-0000-0000-0000-000000000001';
set local role authenticated;
select results_eq($$with changed as (update public.tasks set status='done' where id='99000000-0000-0000-0000-000000000001' returning 1) select count(*) from changed$$, $$values (0::bigint)$$, 'finished event blocks update even for admin');
select results_eq($$with changed as (delete from public.tasks where id='99000000-0000-0000-0000-000000000001' returning 1) select count(*) from changed$$, $$values (0::bigint)$$, 'finished event blocks delete');
reset role;
update public.events set status='cancelled' where id='20000000-0000-0000-0000-000000000001';
set local role authenticated;
select results_eq($$with changed as (update public.tasks set status='done' where id='99000000-0000-0000-0000-000000000001' returning 1) select count(*) from changed$$, $$values (0::bigint)$$, 'cancelled event blocks update');
select results_eq($$with changed as (delete from public.tasks where id='99000000-0000-0000-0000-000000000001' returning 1) select count(*) from changed$$, $$values (0::bigint)$$, 'cancelled event blocks delete');
select * from finish();
rollback;
