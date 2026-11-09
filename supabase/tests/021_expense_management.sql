begin;
select plan(13);

-- Luis (2) organiza; Sofía (3), Darío (4) y Valentina (5) son miembros.
insert into public.events (id, group_id, title, starts_at, ends_at, status, created_by)
values ('90000000-0000-0000-0000-000000000031', '10000000-0000-0000-0000-000000000001',
  'Expense test', now() + interval '1 day', now() + interval '1 day 8 hours',
  'published', '00000000-0000-0000-0000-000000000002');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;

select lives_ok($$select public.create_expense('90000000-0000-0000-0000-000000000031', 'Supermercado', 90,
  '00000000-0000-0000-0000-000000000002', 'comida', jsonb_build_array(
    jsonb_build_object('user_id','00000000-0000-0000-0000-000000000002','amount',30),
    jsonb_build_object('user_id','00000000-0000-0000-0000-000000000003','amount',30),
    jsonb_build_object('user_id','00000000-0000-0000-0000-000000000004','amount',30)))$$,
  'a member records an expense split three ways');
select lives_ok('set constraints all immediate', 'its shares add up to the amount');
set constraints all deferred;

create temporary table bad_expense as
select public.create_expense('90000000-0000-0000-0000-000000000031', 'Mal', 50,
  '00000000-0000-0000-0000-000000000002', 'otro', jsonb_build_array(
    jsonb_build_object('user_id','00000000-0000-0000-0000-000000000002','amount',20))) as id;
select throws_ok('set constraints all immediate', '23514', 'expense shares must add up to the amount',
  'shares must add up to the amount');
delete from public.expenses where id in (select id from bad_expense);
set constraints all deferred;

select throws_ok($$select public.create_expense('90000000-0000-0000-0000-000000000031', 'Externo', 10,
  '00000000-0000-0000-0000-000000000002', 'otro', jsonb_build_array(
    jsonb_build_object('user_id','00000000-0000-0000-0000-0000000000ff','amount',10)))$$,
  '23514', 'participant must be a group member', 'participants must be group members');

select throws_ok($$select public.create_expense('90000000-0000-0000-0000-000000000031', 'Otra categoría', 10,
  '00000000-0000-0000-0000-000000000002', 'casino', jsonb_build_array(
    jsonb_build_object('user_id','00000000-0000-0000-0000-000000000002','amount',10)))$$,
  '23514', null, 'category must be one of the known values');

select lives_ok($$select public.create_expense('90000000-0000-0000-0000-000000000031', 'Hielo', 20,
  '00000000-0000-0000-0000-000000000003', 'compras', jsonb_build_array(
    jsonb_build_object('user_id','00000000-0000-0000-0000-000000000003','amount',10),
    jsonb_build_object('user_id','00000000-0000-0000-0000-000000000002','amount',10)))$$,
  'another member pays an expense');

select is((select sum(net_amount) from public.get_event_balances('90000000-0000-0000-0000-000000000031')),
  0::numeric, 'event balances add up to zero');
select is((select net_amount from public.get_event_balances('90000000-0000-0000-0000-000000000031')
  where user_id = '00000000-0000-0000-0000-000000000002'), 50::numeric, 'payer is owed the net of mutual debts');
select is((select count(*) from public.get_event_debts('90000000-0000-0000-0000-000000000031')),
  2::bigint, 'mutual debts are netted per pair');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
select throws_ok($$select public.settle_event_debt('90000000-0000-0000-0000-000000000031',
  '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002')$$,
  '42501', null, 'a third member cannot settle someone else''s debt');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select is(public.settle_event_debt('90000000-0000-0000-0000-000000000031',
  '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002'), 2,
  'the creditor settles both directions of the pair');
select is((select coalesce(sum(net_amount), 0) from public.get_event_balances('90000000-0000-0000-0000-000000000031')
  where user_id = '00000000-0000-0000-0000-000000000003'), 0::numeric, 'a settled member owes nothing');

reset role;
update public.events set status = 'cancelled' where id = '90000000-0000-0000-0000-000000000031';
set local role authenticated;
select throws_ok($$select public.create_expense('90000000-0000-0000-0000-000000000031', 'Tarde', 10,
  '00000000-0000-0000-0000-000000000002', 'otro', jsonb_build_array(
    jsonb_build_object('user_id','00000000-0000-0000-0000-000000000002','amount',10)))$$,
  '23514', 'event is cancelled', 'cancelled events take no new expenses');

select * from finish();
rollback;
