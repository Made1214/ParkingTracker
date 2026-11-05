-- Aggregate each expense once, independently of its number of splits.
create or replace view public.event_expense_summary
with (security_invoker = true) as
select e.group_id, e.id as event_id, e.title, e.starts_at,
  count(x.id) as expense_count,
  coalesce(sum(x.amount), 0) as total_amount,
  (select count(distinct s.user_id)
   from public.expense_splits s
   join public.expenses ex on ex.id = s.expense_id
   where ex.event_id = e.id) as participant_count,
  coalesce(sum(x.amount) filter (where not exists (
    select 1 from public.expense_splits s
    where s.expense_id = x.id and not s.settled)), 0) as settled_amount
from public.events e
left join public.expenses x on x.event_id = e.id
group by e.group_id, e.id, e.title, e.starts_at;

-- Outstanding credit and debt must be derived from the SAME unsettled
-- splits. Settling a split removes both sides, keeping the sum at zero.
create or replace function public.get_group_balances(p_group_id uuid)
returns table (user_id uuid, net_amount numeric)
language sql stable security invoker set search_path = ''
as $$
  with outstanding as (
    select e.paid_by, s.user_id, s.share_amount
    from public.expenses e
    join public.expense_splits s on s.expense_id = e.id
    where e.group_id = p_group_id and not s.settled
  ), credit as (
    select paid_by, sum(share_amount) as total from outstanding group by paid_by
  ), debt as (
    select user_id, sum(share_amount) as total from outstanding group by user_id
  )
  select gm.user_id, coalesce(c.total, 0) - coalesce(d.total, 0)
  from public.group_members gm
  left join credit c on c.paid_by = gm.user_id
  left join debt d on d.user_id = gm.user_id
  where gm.group_id = p_group_id;
$$;

-- Repeated calls within a transaction must not collide on a temp table.
create or replace function public.suggest_settlements(p_group_id uuid)
returns table ("from_user" uuid, "to_user" uuid, amount numeric)
language plpgsql security invoker set search_path = ''
as $$
declare
  v_ids uuid[];
  v_balances numeric[];
  v_i integer;
  v_j integer;
  v_amount numeric;
begin
  select array_agg(b.user_id order by b.user_id),
         array_agg(b.net_amount order by b.user_id)
    into v_ids, v_balances
  from public.get_group_balances(p_group_id) b;
  loop
    select i into v_i from generate_subscripts(v_balances, 1) i
      where v_balances[i] > 0 order by v_balances[i] desc, v_ids[i] limit 1;
    select i into v_j from generate_subscripts(v_balances, 1) i
      where v_balances[i] < 0 order by v_balances[i], v_ids[i] limit 1;
    exit when v_i is null or v_j is null;
    v_amount := least(v_balances[v_i], -v_balances[v_j]);
    "from_user" := v_ids[v_j]; "to_user" := v_ids[v_i]; amount := v_amount;
    return next;
    v_balances[v_i] := v_balances[v_i] - v_amount;
    v_balances[v_j] := v_balances[v_j] + v_amount;
  end loop;
end;
$$;
