-- Facturas escaneadas e invitados en los gastos de una salida.
--
-- * event_guests: personas sin cuenta que participan en una salida. Solo
--   existen dentro de esa salida y solo pueden DEBER (no pagan gastos).
-- * expense_guest_shares: la parte de un gasto que corresponde a un invitado.
--   Las partes de miembros (expense_splits) + las de invitados suman siempre
--   el monto del gasto (check_expense_total, diferido al confirmar).
-- * receipts: la factura (borrador editable o finalizada). El reparto se
--   calcula en la app (src/features/receipts/lib, centavos enteros) y al
--   finalizar se convierte en gastos normales enlazados (expenses.receipt_id),
--   uno por pagador, para que saldos y deudas sigan usando las funciones
--   existentes. Una factura finalizada es inmutable: para corregirla se
--   reabre (borra sus gastos, solo si ninguna parte está saldada).

-- ---------------------------------------------------------------------
-- 1. Invitados
-- ---------------------------------------------------------------------

create table public.event_guests (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null,
  event_id     uuid not null,
  display_name text not null check (length(trim(display_name)) between 1 and 60),
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  constraint eg_event_fk foreign key (event_id, group_id)
    references public.events (id, group_id) on delete cascade,
  constraint event_guests_id_group_uk unique (id, group_id)
);
create unique index event_guests_event_name_uk
  on public.event_guests (event_id, lower(trim(display_name)));
create index event_guests_event_group_idx on public.event_guests (event_id, group_id);
create index event_guests_created_by_idx on public.event_guests (created_by);

alter table public.event_guests enable row level security;
alter table public.event_guests force  row level security;

create policy event_guests_select on public.event_guests for select to authenticated
  using ((select private.is_group_member(group_id)));
create policy event_guests_insert on public.event_guests for insert to authenticated
  with check ((select private.is_group_member(group_id)) and created_by = (select auth.uid()));
create policy event_guests_update on public.event_guests for update to authenticated
  using (created_by = (select auth.uid()) or (select private.is_group_admin(group_id)))
  with check ((select private.is_group_member(group_id)));
create policy event_guests_delete on public.event_guests for delete to authenticated
  using (created_by = (select auth.uid()) or (select private.is_group_admin(group_id)));

revoke update on public.event_guests from authenticated;
grant update (display_name) on public.event_guests to authenticated;

create function private.guard_event_guest() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user <> 'authenticated' then return new; end if;
  if exists (select 1 from public.events e where e.id = new.event_id and e.status = 'cancelled') then
    raise exception 'event is cancelled' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke execute on function private.guard_event_guest() from public, anon, authenticated;
create trigger event_guests_guard before insert on public.event_guests
  for each row execute function private.guard_event_guest();

-- ---------------------------------------------------------------------
-- 2. Partes de invitados en los gastos
-- ---------------------------------------------------------------------

create table public.expense_guest_shares (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null,
  expense_id   uuid not null,
  guest_id     uuid not null,
  share_amount numeric(12,2) not null check (share_amount > 0),
  settled      boolean not null default false,
  settled_at   timestamptz,
  constraint egs_expense_fk foreign key (expense_id, group_id)
    references public.expenses (id, group_id) on delete cascade,
  -- Un invitado con deudas registradas no se puede borrar.
  constraint egs_guest_fk foreign key (guest_id, group_id)
    references public.event_guests (id, group_id) on delete restrict,
  constraint egs_one_per_guest unique (expense_id, guest_id),
  constraint egs_settled_at check ((settled and settled_at is not null) or (not settled and settled_at is null))
);
create index expense_guest_shares_guest_id_idx on public.expense_guest_shares (guest_id, group_id);
create index expense_guest_shares_expense_group_idx on public.expense_guest_shares (expense_id, group_id);

alter table public.expense_guest_shares enable row level security;
alter table public.expense_guest_shares force  row level security;

create policy expense_guest_shares_select on public.expense_guest_shares for select to authenticated
  using ((select private.is_group_member(group_id)));
create policy expense_guest_shares_insert on public.expense_guest_shares for insert to authenticated
  with check (
    (select private.is_group_member(group_id))
    and exists (
      select 1 from public.expenses e
      where e.id = expense_id
        and (e.created_by = (select auth.uid()) or (select private.is_group_admin(group_id)))
    )
  );
-- Marca como cobrada la parte de un invitado: quien pagó el gasto o un admin.
create policy expense_guest_shares_update on public.expense_guest_shares for update to authenticated
  using (
    exists (select 1 from public.expenses e where e.id = expense_id and e.paid_by = (select auth.uid()))
    or (select private.is_group_admin(group_id))
  )
  with check ((select private.is_group_member(group_id)));
create policy expense_guest_shares_delete on public.expense_guest_shares for delete to authenticated
  using ((select private.is_group_admin(group_id)));

revoke update on public.expense_guest_shares from authenticated;
grant update (settled, settled_at) on public.expense_guest_shares to authenticated;

-- El invitado pertenece a la misma salida que el gasto.
create function private.guard_expense_guest_share() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user <> 'authenticated' then return new; end if;
  if not exists (
    select 1 from public.expenses e join public.event_guests g on g.event_id = e.event_id
    where e.id = new.expense_id and g.id = new.guest_id
  ) then
    raise exception 'guest must belong to the expense event' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke execute on function private.guard_expense_guest_share() from public, anon, authenticated;
create trigger expense_guest_shares_guard before insert on public.expense_guest_shares
  for each row execute function private.guard_expense_guest_share();

-- Las partes de miembros + invitados suman el monto del gasto.
create or replace function private.check_expense_total() returns trigger
language plpgsql set search_path = '' as $$
declare v_expense uuid; v_amount numeric; v_sum numeric;
begin
  if current_user <> 'authenticated' then return null; end if;
  if tg_table_name = 'expenses' then v_expense := new.id;
  elsif tg_op = 'DELETE' then v_expense := old.expense_id;
  else v_expense := new.expense_id; end if;
  select amount into v_amount from public.expenses where id = v_expense;
  if not found then return null; end if; -- gasto borrado: sus partes caen en cascada
  select coalesce((select sum(share_amount) from public.expense_splits where expense_id = v_expense), 0)
       + coalesce((select sum(share_amount) from public.expense_guest_shares where expense_id = v_expense), 0)
  into v_sum;
  if v_sum <> v_amount then
    raise exception 'expense shares must add up to the amount' using errcode = '23514';
  end if;
  return null;
end;
$$;
create constraint trigger expense_guest_shares_check_total after insert or update or delete on public.expense_guest_shares
  deferrable initially deferred for each row execute function private.check_expense_total();

-- ---------------------------------------------------------------------
-- 3. Facturas
-- ---------------------------------------------------------------------

create table public.receipts (
  id                  uuid primary key default gen_random_uuid(),
  group_id            uuid not null,
  event_id            uuid not null,
  created_by          uuid references public.profiles(id) on delete set null,
  status              text not null default 'draft' check (status in ('draft', 'finalized')),
  merchant            text check (merchant is null or length(trim(merchant)) between 1 and 120),
  receipt_date        date,
  printed_total_cents bigint check (printed_total_cents is null or printed_total_cents between 0 and 100000000),
  -- Borrador completo (artículos, asignaciones, impuestos, cargos, pagos,
  -- lectura OCR). Lo valida la app con zod; aquí solo forma y tamaño.
  document            jsonb not null default '{}'::jsonb
    check (jsonb_typeof(document) = 'object' and pg_column_size(document) <= 262144),
  -- Resultado congelado al finalizar (reparto por persona).
  result              jsonb check (result is null or jsonb_typeof(result) = 'object'),
  image_public_id     text,
  version             integer not null default 1 check (version > 0),
  finalized_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint rcp_event_fk foreign key (event_id, group_id)
    references public.events (id, group_id) on delete cascade,
  constraint receipts_id_group_uk unique (id, group_id),
  constraint receipts_image_scope check (
    image_public_id is null
    or image_public_id like 'receipts/' || group_id::text || '/' || event_id::text || '/%'),
  constraint receipts_finalized_shape check (
    (status = 'draft' and finalized_at is null and result is null)
    or (status = 'finalized' and finalized_at is not null and result is not null
        and printed_total_cents is not null))
);
create index receipts_event_group_idx on public.receipts (event_id, group_id);
create index receipts_created_by_idx on public.receipts (created_by);

alter table public.receipts enable row level security;
alter table public.receipts force  row level security;

create policy receipts_select on public.receipts for select to authenticated
  using ((select private.is_group_member(group_id)));
create policy receipts_insert on public.receipts for insert to authenticated
  with check ((select private.is_group_member(group_id)) and created_by = (select auth.uid()));
create policy receipts_update on public.receipts for update to authenticated
  using (created_by = (select auth.uid()) or (select private.is_group_admin(group_id)))
  with check ((select private.is_group_member(group_id)));
create policy receipts_delete on public.receipts for delete to authenticated
  using (created_by = (select auth.uid()) or (select private.is_group_admin(group_id)));

create trigger receipts_set_updated_at
  before update on public.receipts
  for each row execute function private.set_updated_at();

-- Identidad inmutable; una factura finalizada solo cambia por las RPC
-- (que pasan por draft) y la salida no puede estar cancelada.
create function private.guard_receipt() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user <> 'authenticated' then return new; end if;
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id or new.group_id is distinct from old.group_id
      or new.event_id is distinct from old.event_id or new.created_by is distinct from old.created_by
      or new.created_at is distinct from old.created_at then
      raise exception 'receipt identity is immutable' using errcode = '23514';
    end if;
    if old.status = 'finalized' and new.status = 'finalized' then
      raise exception 'receipt is finalized' using errcode = '23514';
    end if;
    if new.version <> old.version + 1 then
      raise exception 'receipt version conflict' using errcode = '40001';
    end if;
  end if;
  if exists (select 1 from public.events e where e.id = new.event_id and e.status = 'cancelled') then
    raise exception 'event is cancelled' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke execute on function private.guard_receipt() from public, anon, authenticated;
create trigger receipts_guard before insert or update on public.receipts
  for each row execute function private.guard_receipt();

-- Gastos generados por una factura.
alter table public.expenses add column receipt_id uuid;
alter table public.expenses add constraint exp_receipt_fk foreign key (receipt_id, group_id)
  references public.receipts (id, group_id) on delete restrict;
create index expenses_receipt_id_idx on public.expenses (receipt_id, group_id);

-- Al confirmar: una factura finalizada tiene gastos que suman exactamente su
-- total impreso, y una en borrador no tiene gastos. Así nadie puede borrar o
-- editar a mano un gasto de una factura finalizada sin reabrirla.
create function private.check_receipt_expenses() returns trigger
language plpgsql set search_path = '' as $$
declare v_receipt uuid; v_status text; v_total bigint; v_sum numeric; v_count integer;
begin
  if current_user <> 'authenticated' then return null; end if;
  if tg_table_name = 'receipts' then v_receipt := new.id;
  elsif tg_op = 'DELETE' then v_receipt := old.receipt_id;
  else v_receipt := coalesce(new.receipt_id, old.receipt_id); end if;
  if v_receipt is null then return null; end if;
  select status, printed_total_cents into v_status, v_total from public.receipts where id = v_receipt;
  if not found then return null; end if;
  select coalesce(sum(amount), 0), count(*) into v_sum, v_count
  from public.expenses where receipt_id = v_receipt;
  if v_status = 'finalized' and (v_count = 0 or v_sum * 100 <> v_total) then
    raise exception 'receipt expenses must add up to its total' using errcode = '23514';
  end if;
  if v_status = 'draft' and v_count > 0 then
    raise exception 'a draft receipt has no expenses' using errcode = '23514';
  end if;
  return null;
end;
$$;
revoke execute on function private.check_receipt_expenses() from public, anon, authenticated;
create constraint trigger receipts_check_expenses after insert or update on public.receipts
  deferrable initially deferred for each row execute function private.check_receipt_expenses();
create constraint trigger expenses_check_receipt after insert or update or delete on public.expenses
  deferrable initially deferred for each row execute function private.check_receipt_expenses();

-- El receipt_id de un gasto no cambia después de crearlo.
create or replace function private.guard_expense() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user <> 'authenticated' then return new; end if;
  if tg_op = 'UPDATE' and (
    new.id is distinct from old.id or new.group_id is distinct from old.group_id
    or new.event_id is distinct from old.event_id or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at or new.receipt_id is distinct from old.receipt_id
  ) then
    raise exception 'expense identity is immutable' using errcode = '23514';
  end if;
  if not exists (select 1 from public.group_members m where m.group_id = new.group_id and m.user_id = new.paid_by) then
    raise exception 'payer must be a group member' using errcode = '23514';
  end if;
  if exists (select 1 from public.events e where e.id = new.event_id and e.status = 'cancelled') then
    raise exception 'event is cancelled' using errcode = '23514';
  end if;
  if new.receipt_id is not null and not exists (
    select 1 from public.receipts r where r.id = new.receipt_id and r.event_id = new.event_id
  ) then
    raise exception 'receipt must belong to the expense event' using errcode = '23514';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. RPC (security invoker: RLS y triggers aplican igual)
-- ---------------------------------------------------------------------

-- Finaliza un borrador: crea un gasto por pagador con sus partes.
-- p_expenses: [{"paid_by": uuid, "amount_cents": int,
--               "splits": [{"user_id": uuid, "amount_cents": int}],
--               "guest_shares": [{"guest_id": uuid, "amount_cents": int}]}]
create function public.finalize_receipt(
  p_receipt_id uuid, p_version integer, p_printed_total_cents bigint,
  p_merchant text, p_receipt_date date, p_document jsonb, p_result jsonb, p_expenses jsonb
) returns integer
language plpgsql security invoker set search_path = '' as $$
declare r public.receipts; v_expense jsonb; v_id uuid; v_description text;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select * into r from public.receipts where id = p_receipt_id for update;
  if not found then raise exception 'receipt not found' using errcode = '42501'; end if;
  if r.status <> 'draft' then raise exception 'receipt is finalized' using errcode = '23514'; end if;
  if r.version <> p_version then raise exception 'receipt version conflict' using errcode = '40001'; end if;
  if jsonb_typeof(p_expenses) <> 'array' or jsonb_array_length(p_expenses) = 0 then
    raise exception 'a receipt needs at least one payer' using errcode = '22023';
  end if;

  update public.receipts set
    status = 'finalized', version = r.version + 1, finalized_at = now(),
    printed_total_cents = p_printed_total_cents, merchant = nullif(trim(p_merchant), ''),
    receipt_date = p_receipt_date, document = p_document, result = p_result
  where id = p_receipt_id;
  if not found then raise exception 'not authorized' using errcode = '42501'; end if;

  v_description := left('Factura · ' || coalesce(nullif(trim(p_merchant), ''), 'sin comercio'), 200);
  for v_expense in select * from jsonb_array_elements(p_expenses) loop
    insert into public.expenses (group_id, event_id, description, amount, paid_by, category, created_by, receipt_id)
    values (r.group_id, r.event_id, v_description, (v_expense->>'amount_cents')::bigint / 100.0,
      (v_expense->>'paid_by')::uuid, 'comida', auth.uid(), r.id)
    returning id into v_id;
    insert into public.expense_splits (group_id, expense_id, user_id, share_amount)
    select r.group_id, v_id, (s->>'user_id')::uuid, (s->>'amount_cents')::bigint / 100.0
    from jsonb_array_elements(coalesce(v_expense->'splits', '[]'::jsonb)) s;
    insert into public.expense_guest_shares (group_id, expense_id, guest_id, share_amount)
    select r.group_id, v_id, (g->>'guest_id')::uuid, (g->>'amount_cents')::bigint / 100.0
    from jsonb_array_elements(coalesce(v_expense->'guest_shares', '[]'::jsonb)) g;
  end loop;
  return r.version + 1;
end;
$$;
revoke execute on function public.finalize_receipt(uuid, integer, bigint, text, date, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.finalize_receipt(uuid, integer, bigint, text, date, jsonb, jsonb, jsonb) to authenticated;

-- Reabre una factura finalizada para corregirla: borra sus gastos (solo si
-- nadie ha marcado todavía una parte como pagada) y vuelve a borrador.
create function public.reopen_receipt(p_receipt_id uuid, p_version integer)
returns integer
language plpgsql security invoker set search_path = '' as $$
declare r public.receipts;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select * into r from public.receipts where id = p_receipt_id for update;
  if not found then raise exception 'receipt not found' using errcode = '42501'; end if;
  if r.status <> 'finalized' then raise exception 'receipt is not finalized' using errcode = '23514'; end if;
  if r.version <> p_version then raise exception 'receipt version conflict' using errcode = '40001'; end if;
  if exists (
    select 1 from public.expenses e join public.expense_splits s on s.expense_id = e.id
    where e.receipt_id = r.id and s.settled and s.user_id <> e.paid_by
  ) or exists (
    select 1 from public.expenses e join public.expense_guest_shares g on g.expense_id = e.id
    where e.receipt_id = r.id and g.settled
  ) then
    raise exception 'receipt has settled payments' using errcode = '23514';
  end if;
  delete from public.expenses where receipt_id = r.id;
  if (select count(*) from public.expenses where receipt_id = r.id) > 0 then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  update public.receipts set status = 'draft', version = r.version + 1, finalized_at = null, result = null
  where id = r.id;
  if not found then raise exception 'not authorized' using errcode = '42501'; end if;
  return r.version + 1;
end;
$$;
revoke execute on function public.reopen_receipt(uuid, integer) from public, anon;
grant execute on function public.reopen_receipt(uuid, integer) to authenticated;
