begin;
select plan(10);

-- Setup: Create event for settlement & idempotency testing
insert into public.events (id, group_id, title, starts_at, ends_at, status, created_by)
values ('90000000-0000-0000-0000-000000000041', '10000000-0000-0000-0000-000000000001',
  'Settlements test', now() + interval '1 day', now() + interval '1 day 8 hours',
  'published', '00000000-0000-0000-0000-000000000001');

-- Set auth context to Ana (user 1)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;

-- Test 1: RF-703 Minimal transfers in a 3-person chain
-- A (user 1) pays 30 split with B (user 2): A pays 30, shares A=15, B=15
select lives_ok($$select public.create_expense(
  '90000000-0000-0000-0000-000000000041',
  'Gasto A',
  30,
  '00000000-0000-0000-0000-000000000001',
  'comida',
  jsonb_build_array(
    jsonb_build_object('user_id', '00000000-0000-0000-0000-000000000001', 'amount', 15),
    jsonb_build_object('user_id', '00000000-0000-0000-0000-000000000002', 'amount', 15)
  )
)$$, 'A pays 30 split with B');

-- Set auth context to Luis (user 2)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);

-- B (user 2) pays 30 split with C (user 3): B pays 30, shares B=15, C=15
select lives_ok($$select public.create_expense(
  '90000000-0000-0000-0000-000000000041',
  'Gasto B',
  30,
  '00000000-0000-0000-0000-000000000002',
  'transporte',
  jsonb_build_array(
    jsonb_build_object('user_id', '00000000-0000-0000-0000-000000000002', 'amount', 15),
    jsonb_build_object('user_id', '00000000-0000-0000-0000-000000000003', 'amount', 15)
  )
)$$, 'B pays 30 split with C');

-- Check net balances: sum is 0, A is +15, B is 0, C is -15
select is((select sum(net_amount) from public.get_event_balances('90000000-0000-0000-0000-000000000041')),
  0::numeric, 'net balances sum to zero');

select is((select net_amount from public.get_event_balances('90000000-0000-0000-0000-000000000041')
  where user_id = '00000000-0000-0000-0000-000000000001'),
  15::numeric, 'A balance is +15');

select is((select coalesce(net_amount, 0) from public.get_event_balances('90000000-0000-0000-0000-000000000041')
  where user_id = '00000000-0000-0000-0000-000000000002'),
  0::numeric, 'B balance is 0');

select is((select net_amount from public.get_event_balances('90000000-0000-0000-0000-000000000041')
  where user_id = '00000000-0000-0000-0000-000000000003'),
  (-15)::numeric, 'C balance is -15');

-- get_event_debts should return a single transfer: C -> A for 15.00 instead of 2 transfers (C->B and B->A)
select is((select count(*) from public.get_event_debts('90000000-0000-0000-0000-000000000041')),
  1::bigint, 'minimal transfers requires only 1 transaction');

select results_eq(
  $$select debtor, creditor, amount from public.get_event_debts('90000000-0000-0000-0000-000000000041')$$,
  $$values ('00000000-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 15.00::numeric)$$,
  'C pays A directly 15.00 to settle the 3-person chain'
);

-- Test 2: API §6 Idempotency key on create_expense
create temporary table exp_first as
select public.create_expense(
  '90000000-0000-0000-0000-000000000041',
  'Idempotent expense',
  20,
  '00000000-0000-0000-0000-000000000002',
  'alojamiento',
  jsonb_build_array(
    jsonb_build_object('user_id', '00000000-0000-0000-0000-000000000002', 'amount', 10),
    jsonb_build_object('user_id', '00000000-0000-0000-0000-000000000003', 'amount', 10)
  ),
  'e0000000-0000-0000-0000-000000000001'::uuid
) as id;

create temporary table exp_second as
select public.create_expense(
  '90000000-0000-0000-0000-000000000041',
  'Idempotent expense',
  20,
  '00000000-0000-0000-0000-000000000002',
  'alojamiento',
  jsonb_build_array(
    jsonb_build_object('user_id', '00000000-0000-0000-0000-000000000002', 'amount', 10),
    jsonb_build_object('user_id', '00000000-0000-0000-0000-000000000003', 'amount', 10)
  ),
  'e0000000-0000-0000-0000-000000000001'::uuid
) as id;

select is(
  (select id from exp_first),
  (select id from exp_second),
  'double-submitting create_expense with same idempotency key returns same id'
);

select is(
  (select count(*)::int from public.expenses where idempotency_key = 'e0000000-0000-0000-0000-000000000001'),
  1,
  'only 1 expense row is created when using the same idempotency key'
);

select * from finish();
rollback;
