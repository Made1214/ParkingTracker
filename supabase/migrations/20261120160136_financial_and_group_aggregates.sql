-- Cuenta miembros e invitados por separado y respeta ambos tipos de cuotas.
create or replace view public.event_expense_summary
with (security_invoker = true) as
select e.group_id, e.id as event_id, e.title, e.starts_at,
  count(x.id) as expense_count,
  coalesce(sum(x.amount), 0) as total_amount,
  (select count(distinct s.user_id)
   from public.expense_splits s join public.expenses ex on ex.id = s.expense_id
   where ex.event_id = e.id)
  + (select count(distinct s.guest_id)
     from public.expense_guest_shares s join public.expenses ex on ex.id = s.expense_id
     where ex.event_id = e.id) as participant_count,
  coalesce(sum(x.amount) filter (where not exists (
    select 1 from public.expense_splits s
    where s.expense_id = x.id and s.user_id <> x.paid_by and not s.settled
  ) and not exists (
    select 1 from public.expense_guest_shares s where s.expense_id = x.id and not s.settled
  )), 0) as settled_amount
from public.events e
left join public.expenses x on x.event_id = e.id
group by e.group_id, e.id, e.title, e.starts_at;

-- Cuenta las salidas que cada miembro pudo confirmar antes de su inicio.
create or replace view public.member_participation
with (security_invoker = true) as
select gm.group_id, gm.user_id, p.display_name,
  count(*) filter (where ea.status = 'going') as events_attended,
  count(*) filter (where ea.status = 'maybe') as events_maybe,
  count(*) filter (where ea.status = 'declined') as events_declined,
  count(e.id) as events_invited,
  round(100.0 * count(*) filter (where ea.status = 'going') / nullif(count(e.id), 0), 1) as attendance_pct
from public.group_members gm
join public.profiles p on p.id = gm.user_id
left join public.events e on e.group_id = gm.group_id
  and (e.status = 'finished' or (e.status = 'published' and e.ends_at <= now()))
  and gm.joined_at <= e.starts_at
left join public.event_attendance ea on ea.event_id = e.id and ea.user_id = gm.user_id
group by gm.group_id, gm.user_id, p.display_name;

-- Calcula los KPI sin descargar todas las filas de la página del grupo.
create function public.get_group_event_counts(p_group_id uuid)
returns table (finished bigint, upcoming bigint, drafts bigint, cancelled bigint)
language sql stable security invoker set search_path = '' as $$
  select count(*) filter (where status = 'finished' or (status = 'published' and ends_at <= now())),
    count(*) filter (where status = 'published' and ends_at > now()),
    count(*) filter (where status = 'draft'),
    count(*) filter (where status = 'cancelled')
  from public.events where group_id = p_group_id;
$$;

-- Agrega las fuentes de historial en Postgres antes del límite de PostgREST.
create function public.get_group_stats(p_group_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  with events as (
    select e.id, e.title, e.location, e.starts_at,
      e.status = 'finished' or e.ends_at <= now() as past
    from public.events e where e.group_id = p_group_id and e.status in ('published', 'finished')
  ), history as (
    select e.id, e.title, e.location, e.starts_at as "startsAt",
      (select count(*) from public.event_attendance a where a.event_id = e.id and a.status = 'going') as going,
      (select count(*) from public.photos p where p.event_id = e.id) as photos,
      coalesce((select sum(x.amount) * 100 from public.expenses x where x.event_id = e.id), 0) as cents
    from events e where e.past
  ), ranking as (
    select user_id, display_name, events_attended, events_invited
    from public.member_participation where group_id = p_group_id
  ), months as (
    select to_char(starts_at at time zone 'America/Panama', 'YYYY-MM') as key, count(*) as total
    from events
    where starts_at at time zone 'America/Panama' >=
      date_trunc('month', now() at time zone 'America/Panama') - interval '5 months'
    group by 1
  )
  select jsonb_build_object(
    'groupName', g.name,
    'members', (select count(*) from ranking),
    'history', (select coalesce(jsonb_agg(h order by h."startsAt" desc, h.id desc), '[]') from history h),
    'ranking', (select coalesce(jsonb_agg(r), '[]') from ranking r),
    'months', (select coalesce(jsonb_object_agg(m.key, m.total), '{}') from months m),
    'averageAttendance', (select round(100.0 * sum(events_attended) / nullif(sum(events_invited), 0)) from ranking),
    'totalCents', (select coalesce(sum(cents), 0) from history),
    'averageCents', (select coalesce(round(avg(cents)), 0) from history),
    'photoCount', (select count(*) from public.photos p where p.group_id = g.id),
    'usedBytes', coalesce(u.bytes_used, 0),
    'quotaBytes', coalesce(u.bytes_quota, 104857600)
  )
  from public.groups g left join public.group_storage_usage u on u.group_id = g.id
  where g.id = p_group_id;
$$;

-- Acumula el saldo del usuario en todos sus grupos desde las cuotas pendientes.
create function public.get_dashboard_balance()
returns numeric language sql stable security invoker set search_path = '' as $$
  select coalesce(sum(case when s.user_id = (select auth.uid()) then -s.share_amount else s.share_amount end), 0)
  from public.expense_splits s
  join public.expenses e on e.id = s.expense_id
  where not s.settled and s.user_id <> e.paid_by
    and ((select auth.uid()) = e.paid_by or (select auth.uid()) = s.user_id);
$$;

-- Devuelve las cuatro deudas más recientes para el resumen del inicio.
create function public.get_dashboard_debts()
returns table (event_id uuid, group_id uuid, title text, amount numeric, creditors uuid[])
language sql stable security invoker set search_path = '' as $$
  with candidates as (
    select distinct e.event_id
    from public.expense_splits s join public.expenses e on e.id = s.expense_id
    where s.user_id = (select auth.uid()) and not s.settled and s.user_id <> e.paid_by
  )
  select e.id, e.group_id, e.title, d.amount, d.creditors
  from candidates c join public.events e on e.id = c.event_id
  cross join lateral (
    select sum(amount) as amount, array_agg(creditor order by creditor) as creditors
    from public.get_event_debts(e.id) where debtor = (select auth.uid())
  ) d
  where d.amount is not null
  order by e.starts_at desc, e.id desc
  limit 4;
$$;

revoke all on function public.get_group_event_counts(uuid), public.get_group_stats(uuid),
  public.get_dashboard_balance(), public.get_dashboard_debts() from public, anon;
grant execute on function public.get_group_event_counts(uuid), public.get_group_stats(uuid),
  public.get_dashboard_balance(), public.get_dashboard_debts() to authenticated;

-- Mantiene un solo gasto para envíos concurrentes con la misma clave.
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
  on conflict (event_id, created_by, idempotency_key) where idempotency_key is not null
    do nothing
  returning id into v_id;

  -- Otra transacción pudo confirmar este mismo envío mientras se insertaba.
  if v_id is null then
    select id into strict v_id from public.expenses
    where event_id = p_event_id and created_by = auth.uid() and idempotency_key = p_idempotency_key;
    return v_id;
  end if;
  insert into public.expense_splits (group_id, expense_id, user_id, share_amount)
  select v_group, v_id, (s->>'user_id')::uuid, (s->>'amount')::numeric
  from jsonb_array_elements(p_shares) s;
  return v_id;
end;
$$;
