-- Gastos compartidos (US-07, RF-701 a RF-705).
-- * Categoría por gasto.
-- * Un gasto y sus partes se registran juntos (create_expense) y sus partes
--   siempre suman el total: lo comprueba un trigger diferido al confirmar.
-- * Quien paga y quienes participan son miembros del grupo; no se registran
--   gastos en salidas canceladas.
-- * Saldos y deudas por salida, y una función para saldar entre dos personas.

alter table public.expenses
  add column category text not null default 'otro'
    check (category in ('comida', 'transporte', 'alojamiento', 'entradas', 'compras', 'otro'));

-- Identidad inmutable, pagador miembro y salida no cancelada.
create function private.guard_expense() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user <> 'authenticated' then return new; end if;
  if tg_op = 'UPDATE' and (
    new.id is distinct from old.id or new.group_id is distinct from old.group_id
    or new.event_id is distinct from old.event_id or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'expense identity is immutable' using errcode = '23514';
  end if;
  if not exists (select 1 from public.group_members m where m.group_id = new.group_id and m.user_id = new.paid_by) then
    raise exception 'payer must be a group member' using errcode = '23514';
  end if;
  if exists (select 1 from public.events e where e.id = new.event_id and e.status = 'cancelled') then
    raise exception 'event is cancelled' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke execute on function private.guard_expense() from public, anon, authenticated;
create trigger expenses_guard before insert or update on public.expenses
  for each row execute function private.guard_expense();

-- Las partes pertenecen a miembros del grupo.
create function private.guard_expense_split() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user <> 'authenticated' then return new; end if;
  if tg_op = 'UPDATE' and (
    new.id is distinct from old.id or new.group_id is distinct from old.group_id
    or new.expense_id is distinct from old.expense_id or new.user_id is distinct from old.user_id
  ) then
    raise exception 'expense split identity is immutable' using errcode = '23514';
  end if;
  if not exists (select 1 from public.group_members m where m.group_id = new.group_id and m.user_id = new.user_id) then
    raise exception 'participant must be a group member' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke execute on function private.guard_expense_split() from public, anon, authenticated;
create trigger expense_splits_guard before insert or update on public.expense_splits
  for each row execute function private.guard_expense_split();

-- Al confirmar, las partes de cada gasto tocado suman exactamente su monto.
create function private.check_expense_total() returns trigger
language plpgsql set search_path = '' as $$
declare v_expense uuid; v_amount numeric; v_sum numeric;
begin
  if current_user <> 'authenticated' then return null; end if;
  if tg_table_name = 'expenses' then v_expense := new.id;
  elsif tg_op = 'DELETE' then v_expense := old.expense_id;
  else v_expense := new.expense_id; end if;
  select amount into v_amount from public.expenses where id = v_expense;
  if not found then return null; end if; -- gasto borrado: sus partes caen en cascada
  select coalesce(sum(share_amount), 0) into v_sum from public.expense_splits where expense_id = v_expense;
  if v_sum <> v_amount then
    raise exception 'expense shares must add up to the amount' using errcode = '23514';
  end if;
  return null;
end;
$$;
revoke execute on function private.check_expense_total() from public, anon, authenticated;
create constraint trigger expenses_check_total after insert or update of amount on public.expenses
  deferrable initially deferred for each row execute function private.check_expense_total();
create constraint trigger expense_splits_check_total after insert or update or delete on public.expense_splits
  deferrable initially deferred for each row execute function private.check_expense_total();

-- Registra un gasto con sus partes en una sola operación (con RLS: security invoker).
-- p_shares: [{"user_id": "...", "amount": 12.50}, ...]
create function public.create_expense(
  p_event_id uuid, p_description text, p_amount numeric, p_paid_by uuid,
  p_category text, p_shares jsonb
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare v_group uuid; v_id uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select group_id into v_group from public.events where id = p_event_id;
  if not found then raise exception 'event not found' using errcode = '42501'; end if;
  if jsonb_typeof(p_shares) <> 'array' or jsonb_array_length(p_shares) = 0 then
    raise exception 'an expense needs participants' using errcode = '22023';
  end if;
  insert into public.expenses (group_id, event_id, description, amount, paid_by, category, created_by)
  values (v_group, p_event_id, p_description, p_amount, p_paid_by, coalesce(p_category, 'otro'), auth.uid())
  returning id into v_id;
  insert into public.expense_splits (group_id, expense_id, user_id, share_amount)
  select v_group, v_id, (s->>'user_id')::uuid, (s->>'amount')::numeric
  from jsonb_array_elements(p_shares) s;
  return v_id;
end;
$$;
revoke execute on function public.create_expense(uuid, text, numeric, uuid, text, jsonb) from public, anon;
grant execute on function public.create_expense(uuid, text, numeric, uuid, text, jsonb) to authenticated;

-- Saldo pendiente por miembro en una salida (suma cero).
create function public.get_event_balances(p_event_id uuid)
returns table (user_id uuid, net_amount numeric)
language sql stable security invoker set search_path = '' as $$
  with outstanding as (
    select e.paid_by, s.user_id, s.share_amount
    from public.expenses e
    join public.expense_splits s on s.expense_id = e.id
    where e.event_id = p_event_id and not s.settled and s.user_id <> e.paid_by
  ), people as (
    select paid_by as user_id from outstanding union select user_id from outstanding
  )
  select p.user_id,
    coalesce((select sum(o.share_amount) from outstanding o where o.paid_by = p.user_id), 0)
    - coalesce((select sum(o.share_amount) from outstanding o where o.user_id = p.user_id), 0)
  from people p;
$$;
revoke execute on function public.get_event_balances(uuid) from public, anon;
grant execute on function public.get_event_balances(uuid) to authenticated;

-- Deudas pendientes por pareja dentro de una salida, compensando las mutuas.
create function public.get_event_debts(p_event_id uuid)
returns table (debtor uuid, creditor uuid, amount numeric)
language sql stable security invoker set search_path = '' as $$
  with outstanding as (
    select s.user_id as debtor, e.paid_by as creditor, s.share_amount
    from public.expenses e
    join public.expense_splits s on s.expense_id = e.id
    where e.event_id = p_event_id and not s.settled and s.user_id <> e.paid_by
  ), pairs as (
    select least(debtor, creditor) as a, greatest(debtor, creditor) as b,
      sum(case when debtor < creditor then share_amount else -share_amount end) as net
    from outstanding group by 1, 2
  )
  select case when net > 0 then a else b end,
         case when net > 0 then b else a end,
         abs(net)
  from pairs where net <> 0
  order by abs(net) desc;
$$;
revoke execute on function public.get_event_debts(uuid) from public, anon;
grant execute on function public.get_event_debts(uuid) to authenticated;

-- Marca como saldadas todas las partes pendientes entre dos personas en una
-- salida (en ambos sentidos). Puede hacerlo cualquiera de las dos o un admin.
create function public.settle_event_debt(p_event_id uuid, p_debtor uuid, p_creditor uuid)
returns integer
language plpgsql security definer set search_path = '' as $$
declare v_group uuid; v_count integer;
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
  return v_count;
end;
$$;
revoke execute on function public.settle_event_debt(uuid, uuid, uuid) from public, anon;
grant execute on function public.settle_event_debt(uuid, uuid, uuid) to authenticated;

create index expenses_event_paid_by_idx on public.expenses (event_id, paid_by);
