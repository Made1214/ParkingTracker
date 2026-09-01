-- 015_expense_rpcs.sql
create or replace function public.get_group_balances(p_group_id uuid)
returns table (user_id uuid, net_amount numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  -- Net amount per member across one snapshot: what they paid for others
  -- minus what they owe others. Sums to zero by construction, because
  -- every dollar owed by a split has exactly one payer in expenses.
  with paid as (
    select e.paid_by as user_id, sum(e.amount) as total
    from public.expenses e
    where e.group_id = p_group_id
    group by e.paid_by
  ),
  owed as (
    select s.user_id, sum(s.share_amount) as total
    from public.expense_splits s
    join public.expenses e on e.id = s.expense_id
    where e.group_id = p_group_id and not s.settled
    group by s.user_id
  )
  select
    gm.user_id,
    coalesce(paid.total, 0) - coalesce(owed.total, 0) as net_amount
  from public.group_members gm
  left join paid on paid.user_id = gm.user_id
  left join owed on owed.user_id = gm.user_id
  where gm.group_id = p_group_id;
$$;

-- Not STABLE: it creates a temporary table internally, which is a write
-- operation. Marking it stable would be a lie the planner could act on.
create or replace function public.suggest_settlements(p_group_id uuid)
returns table ("from_user" uuid, "to_user" uuid, amount numeric)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_debtors  record;
  v_creditor record;
  v_amount   numeric;
begin
  -- Greedy min-cash-flow over the same snapshot as get_group_balances,
  -- with a deterministic user_id tie-break so two clients always render
  -- the identical transfer list.
  create temporary table _balances on commit drop as
  select b.user_id, b.net_amount as balance
  from public.get_group_balances(p_group_id) b
  where b.net_amount <> 0;

  while exists (select 1 from _balances where balance > 0)
    and exists (select 1 from _balances where balance < 0) loop

    select user_id, balance into v_creditor
    from _balances where balance > 0
    order by balance desc, user_id asc limit 1;

    select user_id, balance into v_debtors
    from _balances where balance < 0
    order by balance asc, user_id asc limit 1;

    v_amount := least(v_creditor.balance, -v_debtors.balance);

    "from_user" := v_debtors.user_id;
    "to_user"   := v_creditor.user_id;
    amount      := round(v_amount, 2);
    return next;

    update _balances set balance = balance - v_amount where user_id = v_creditor.user_id;
    update _balances set balance = balance + v_amount where user_id = v_debtors.user_id;
  end loop;
end;
$$;

revoke execute on function public.get_group_balances(uuid)  from public, anon;
revoke execute on function public.suggest_settlements(uuid) from public, anon;
grant  execute on function public.get_group_balances(uuid)  to authenticated;
grant  execute on function public.suggest_settlements(uuid) to authenticated;
