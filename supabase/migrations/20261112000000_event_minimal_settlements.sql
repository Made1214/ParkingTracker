-- Minimal settlements per event (RF-703) and expense idempotency (API §6).
-- * Idempotency key on expenses to prevent duplicate creations on double submit.
-- * Pure in-memory greedy min-cash-flow algorithm for get_event_debts.
-- * Multi-party settlement support in settle_event_debt.

alter table public.expenses
  add column idempotency_key uuid;

create unique index expenses_event_idempotency_key_idx
  on public.expenses (event_id, created_by, idempotency_key)
  where idempotency_key is not null;

-- Drop previous 6-argument overload to avoid PostgREST ambiguities
drop function if exists public.create_expense(uuid, text, numeric, uuid, text, jsonb);

create or replace function public.create_expense(
  p_event_id uuid,
  p_description text,
  p_amount numeric,
  p_paid_by uuid,
  p_category text,
  p_shares jsonb,
  p_idempotency_key uuid default null
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_group uuid;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select group_id into v_group from public.events where id = p_event_id;
  if not found then raise exception 'event not found' using errcode = '42501'; end if;

  if p_idempotency_key is not null then
    select id into v_id
    from public.expenses
    where event_id = p_event_id
      and created_by = auth.uid()
      and idempotency_key = p_idempotency_key;
    if v_id is not null then
      return v_id;
    end if;
  end if;

  if jsonb_typeof(p_shares) <> 'array' or jsonb_array_length(p_shares) = 0 then
    raise exception 'an expense needs participants' using errcode = '22023';
  end if;
  insert into public.expenses (group_id, event_id, description, amount, paid_by, category, created_by, idempotency_key)
  values (v_group, p_event_id, p_description, p_amount, p_paid_by, coalesce(p_category, 'otro'), auth.uid(), p_idempotency_key)
  returning id into v_id;
  insert into public.expense_splits (group_id, expense_id, user_id, share_amount)
  select v_group, v_id, (s->>'user_id')::uuid, (s->>'amount')::numeric
  from jsonb_array_elements(p_shares) s;
  return v_id;
end;
$$;

revoke execute on function public.create_expense(uuid, text, numeric, uuid, text, jsonb, uuid) from public, anon;
grant execute on function public.create_expense(uuid, text, numeric, uuid, text, jsonb, uuid) to authenticated;

-- Minimum transfers per event (RF-703): greedy min-cash-flow in-memory using arrays (STABLE)
create or replace function public.get_event_debts(p_event_id uuid)
returns table (debtor uuid, creditor uuid, amount numeric)
language plpgsql stable security invoker set search_path = '' as $$
declare
  v_cred_users uuid[];
  v_cred_bals  numeric[];
  v_deb_users  uuid[];
  v_deb_bals   numeric[];
  v_n_cred     int;
  v_n_deb      int;
  v_best_cred  int;
  v_best_deb   int;
  v_transfer   numeric;
  i            int;
begin
  select coalesce(array_agg(b.user_id order by b.net_amount desc, b.user_id asc), array[]::uuid[]),
         coalesce(array_agg(b.net_amount order by b.net_amount desc, b.user_id asc), array[]::numeric[])
  into v_cred_users, v_cred_bals
  from public.get_event_balances(p_event_id) b
  where b.net_amount > 0.005;

  select coalesce(array_agg(b.user_id order by b.net_amount asc, b.user_id asc), array[]::uuid[]),
         coalesce(array_agg(b.net_amount order by b.net_amount asc, b.user_id asc), array[]::numeric[])
  into v_deb_users, v_deb_bals
  from public.get_event_balances(p_event_id) b
  where b.net_amount < -0.005;

  v_n_cred := coalesce(array_length(v_cred_users, 1), 0);
  v_n_deb  := coalesce(array_length(v_deb_users, 1), 0);

  if v_n_cred = 0 or v_n_deb = 0 then
    return;
  end if;

  loop
    v_best_cred := 0;
    for i in 1..v_n_cred loop
      if v_cred_bals[i] > 0.005 then
        if v_best_cred = 0 or
           v_cred_bals[i] > v_cred_bals[v_best_cred] or
           (v_cred_bals[i] = v_cred_bals[v_best_cred] and v_cred_users[i] < v_cred_users[v_best_cred]) then
          v_best_cred := i;
        end if;
      end if;
    end loop;

    v_best_deb := 0;
    for i in 1..v_n_deb loop
      if v_deb_bals[i] < -0.005 then
        if v_best_deb = 0 or
           v_deb_bals[i] < v_deb_bals[v_best_deb] or
           (v_deb_bals[i] = v_deb_bals[v_best_deb] and v_deb_users[i] < v_deb_users[v_best_deb]) then
          v_best_deb := i;
        end if;
      end if;
    end loop;

    if v_best_cred = 0 or v_best_deb = 0 then
      exit;
    end if;

    v_transfer := round(least(v_cred_bals[v_best_cred], -v_deb_bals[v_best_deb]), 2);
    if v_transfer <= 0 then
      exit;
    end if;

    debtor := v_deb_users[v_best_deb];
    creditor := v_cred_users[v_best_cred];
    amount := v_transfer;
    return next;

    v_cred_bals[v_best_cred] := v_cred_bals[v_best_cred] - v_transfer;
    v_deb_bals[v_best_deb] := v_deb_bals[v_best_deb] + v_transfer;
  end loop;
end;
$$;

revoke execute on function public.get_event_debts(uuid) from public, anon;
grant execute on function public.get_event_debts(uuid) to authenticated;

-- settle_event_debt: supports both direct pairwise settlements and multi-party transitive settlements
create or replace function public.settle_event_debt(p_event_id uuid, p_debtor uuid, p_creditor uuid)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_group uuid;
  v_count integer;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select group_id into v_group from public.events where id = p_event_id;
  if not found or not private.is_group_member(v_group)
    or (auth.uid() not in (p_debtor, p_creditor) and not private.is_group_admin(v_group)) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  update public.expense_splits s set settled = true, settled_at = now()
  from public.expenses e
  where e.id = s.expense_id and e.event_id = p_event_id and not s.settled
    and ((s.user_id = p_debtor and e.paid_by = p_creditor)
      or (s.user_id = p_creditor and e.paid_by = p_debtor));
  get diagnostics v_count = row_count;

  if v_count = 0 and exists (
    select 1 from public.get_event_debts(p_event_id) d
    where d.debtor = p_debtor and d.creditor = p_creditor
  ) then
    update public.expense_splits s set settled = true, settled_at = now()
    from public.expenses e
    where e.id = s.expense_id and e.event_id = p_event_id and not s.settled
      and (s.user_id = p_debtor or e.paid_by = p_creditor);
    get diagnostics v_count = row_count;
  end if;

  return v_count;
end;
$$;

revoke execute on function public.settle_event_debt(uuid, uuid, uuid) from public, anon;
grant execute on function public.settle_event_debt(uuid, uuid, uuid) to authenticated;
