begin;
select plan(12);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;

insert into public.events (id, group_id, title, starts_at, ends_at, created_by)
values ('80000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
  'Expense regression', now(), now() + interval '1 hour', '00000000-0000-0000-0000-000000000001');
insert into public.expenses (id, group_id, event_id, description, amount, paid_by, created_by)
values ('81000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
  '80000000-0000-0000-0000-000000000001', 'Dinner', 30,
  '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001');
insert into public.expense_splits (group_id, expense_id, user_id, share_amount)
select '10000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001', id, 10
from public.profiles where id in ('00000000-0000-0000-0000-000000000001',
 '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003');

select is(total_amount, 30::numeric, 'three splits do not triple expense total')
from public.event_expense_summary where event_id = '80000000-0000-0000-0000-000000000001';
select is(expense_count, 1::bigint, 'expense counted once')
from public.event_expense_summary where event_id = '80000000-0000-0000-0000-000000000001';
select is(participant_count, 3::bigint, 'distinct participants counted')
from public.event_expense_summary where event_id = '80000000-0000-0000-0000-000000000001';
select is(settled_amount, 0::numeric, 'unsettled expense excluded from settled total')
from public.event_expense_summary where event_id = '80000000-0000-0000-0000-000000000001';
select is(sum(net_amount), 0::numeric, 'outstanding balances sum to zero')
from public.get_group_balances('10000000-0000-0000-0000-000000000001');

create temporary table balances_before as
select * from public.get_group_balances('10000000-0000-0000-0000-000000000001');
update public.expense_splits set settled = true, settled_at = now()
where expense_id = '81000000-0000-0000-0000-000000000001'
  and user_id = '00000000-0000-0000-0000-000000000002';
select is(sum(net_amount), 0::numeric, 'partial settlement preserves zero sum')
from public.get_group_balances('10000000-0000-0000-0000-000000000001');
select is(b.net_amount - old.net_amount, -10::numeric, 'settlement reduces payer credit')
from public.get_group_balances('10000000-0000-0000-0000-000000000001') b
join balances_before old using (user_id) where user_id = '00000000-0000-0000-0000-000000000001';
select is(b.net_amount - old.net_amount, 10::numeric, 'settlement reduces participant debt')
from public.get_group_balances('10000000-0000-0000-0000-000000000001') b
join balances_before old using (user_id) where user_id = '00000000-0000-0000-0000-000000000002';
select lives_ok($$select * from public.suggest_settlements('10000000-0000-0000-0000-000000000001')$$, 'first suggestion succeeds');
select lives_ok($$select * from public.suggest_settlements('10000000-0000-0000-0000-000000000001')$$, 'repeated suggestion succeeds in same transaction');
update public.expense_splits set settled = true, settled_at = now()
where expense_id = '81000000-0000-0000-0000-000000000001';
select is(settled_amount, 30::numeric, 'fully settled total counted once')
from public.event_expense_summary where event_id = '80000000-0000-0000-0000-000000000001';
select is(sum(net_amount), 0::numeric, 'full settlement preserves zero sum')
from public.get_group_balances('10000000-0000-0000-0000-000000000001');
select * from finish();
rollback;
