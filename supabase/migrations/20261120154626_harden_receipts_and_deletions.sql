-- La autoría histórica no permite borrar filas tras salir del grupo.
do $$
declare v_table text;
begin
  foreach v_table in array array['receipts', 'event_guests', 'expense_guest_shares'] loop
    execute format(
      'create policy current_member_delete_guard on public.%I as restrictive for delete to authenticated using ((select private.is_group_member(group_id)))',
      v_table
    );
  end loop;
end;
$$;

-- Conserva la contabilidad del recibo y aplica el estado de la salida al borrado.
create or replace function private.guard_receipt() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if current_user = 'authenticated' then
      if old.status <> 'draft' then
        raise exception 'receipt is finalized' using errcode = '23514';
      end if;
      if exists (select 1 from public.events e where e.id = old.event_id and e.status = 'cancelled') then
        raise exception 'event is cancelled' using errcode = '23514';
      end if;
    end if;
    return old;
  end if;
  if current_user <> 'authenticated' then return new; end if;
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id or new.group_id is distinct from old.group_id
      or new.event_id is distinct from old.event_id or new.created_by is distinct from old.created_by
      or new.created_at is distinct from old.created_at then
      raise exception 'receipt identity is immutable' using errcode = '23514';
    end if;
    if old.status = 'finalized' then
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

drop trigger receipts_guard on public.receipts;
create trigger receipts_guard before insert or update or delete on public.receipts
  for each row execute function private.guard_receipt();

create policy receipt_expenses_update_guard on public.expenses
  as restrictive for update to authenticated
  using (receipt_id is null)
  with check (receipt_id is null);

revoke update on public.expense_splits from authenticated;

-- Solo liquida cuotas entre ambas personas y cuando cuadran con la transferencia.
drop function public.settle_event_debt(uuid, uuid, uuid);
create function public.settle_event_debt(
  p_event_id uuid, p_debtor uuid, p_creditor uuid, p_amount numeric default null
)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_group uuid;
  v_suggested numeric;
  v_direct numeric;
  v_count integer;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select group_id into v_group from public.events where id = p_event_id for update;
  if not found or not private.is_group_member(v_group)
    or (v_user is distinct from p_debtor and v_user is distinct from p_creditor
        and not private.is_group_admin(v_group)) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  -- Bloquea las cuotas y sus gastos para comprobar y aplicar el mismo saldo.
  perform 1 from public.expense_splits s
  join public.expenses e on e.id = s.expense_id
  where e.event_id = p_event_id
  order by e.id, s.id for update of e, s;

  select d.amount into v_suggested
  from public.get_event_debts(p_event_id) d
  where d.debtor = p_debtor and d.creditor = p_creditor;
  select coalesce(sum(case when s.user_id = p_debtor then s.share_amount else -s.share_amount end), 0)
    into v_direct
  from public.expense_splits s
  join public.expenses e on e.id = s.expense_id
  where e.event_id = p_event_id and not s.settled
    and ((s.user_id = p_debtor and e.paid_by = p_creditor)
      or (s.user_id = p_creditor and e.paid_by = p_debtor));
  if v_direct <= 0 or v_suggested is distinct from v_direct
    or (p_amount is not null and p_amount <> v_direct) then
    raise exception 'settlement amount does not match direct debt' using errcode = '22023';
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
revoke all on function public.settle_event_debt(uuid, uuid, uuid, numeric) from public, anon;
grant execute on function public.settle_event_debt(uuid, uuid, uuid, numeric) to authenticated;

alter policy events_delete on public.events
  using (
    status = 'draft'
    and cover_public_id is null
    and (created_by = (select auth.uid()) or (select private.is_group_admin(group_id)))
    and not exists (select 1 from public.photos p where p.event_id = events.id)
    and not exists (select 1 from public.receipts r where r.event_id = events.id)
  );

-- Cierra las votaciones al finalizar o cancelar una salida, incluido el cron.
create function private.close_event_polls() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.polls set status = 'closed'
  where event_id = new.id and status = 'open';
  return new;
end;
$$;
revoke all on function private.close_event_polls() from public, anon, authenticated;

create trigger close_event_polls after update of status on public.events
  for each row when (old.status is distinct from new.status and new.status in ('finished', 'cancelled'))
  execute function private.close_event_polls();

update public.polls p set status = 'closed'
from public.events e where e.id = p.event_id
  and e.status in ('finished', 'cancelled') and p.status = 'open';

-- El creador o un admin pueden reabrir un recibo sin pagos.
create or replace function public.reopen_receipt(p_receipt_id uuid, p_version integer)
returns integer
language plpgsql security definer set search_path = '' as $$
declare r public.receipts; v_status public.event_status;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select * into r from public.receipts where id = p_receipt_id;
  if not found or not private.is_group_member(r.group_id)
    or (r.created_by is distinct from auth.uid() and not private.is_group_admin(r.group_id)) then
    raise exception 'receipt not found' using errcode = '42501';
  end if;
  select e.status into v_status from public.events e where e.id = r.event_id for update;
  select * into r from public.receipts where id = p_receipt_id for update;
  if not found or not private.is_group_member(r.group_id)
    or (r.created_by is distinct from auth.uid() and not private.is_group_admin(r.group_id)) then
    raise exception 'receipt not found' using errcode = '42501';
  end if;
  if v_status = 'cancelled' then
    raise exception 'event is cancelled' using errcode = '23514';
  end if;
  if r.status <> 'finalized' then raise exception 'receipt is not finalized' using errcode = '23514'; end if;
  if r.version <> p_version then raise exception 'receipt version conflict' using errcode = '40001'; end if;
  perform 1 from public.expense_guest_shares g join public.expenses e on e.id = g.expense_id
  where e.receipt_id = r.id order by g.id for update of g;
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

-- Los gastos deben desaparecer antes de sus recibos o invitados (FK RESTRICT).
create function private.remove_group_receipt_expenses(p_group_id uuid)
returns text[] language plpgsql set search_path = '' as $$
declare v_images text[];
begin
  perform 1 from public.receipts where group_id = p_group_id order by id for update;
  select coalesce(array_agg(image_public_id order by id)
    filter (where image_public_id is not null), '{}'::text[])
  into v_images from public.receipts where group_id = p_group_id;

  delete from public.expenses where group_id = p_group_id
    and (receipt_id is not null or exists (
      select 1 from public.expense_guest_shares s where s.expense_id = expenses.id
    ));
  return v_images;
end;
$$;
revoke all on function private.remove_group_receipt_expenses(uuid) from public, anon, authenticated;

-- Un JWT emitido antes de anonimizar una cuenta ya no permite editar su perfil.
create function private.active_profile()
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.users u
    where u.id = (select auth.uid()) and u.banned_until is distinct from 'infinity'::timestamptz
  );
$$;
revoke all on function private.active_profile() from public, anon;
grant execute on function private.active_profile() to authenticated;

alter policy profiles_update on public.profiles
  using (id = (select auth.uid()) and (select private.active_profile()))
  with check (id = (select auth.uid()) and (select private.active_profile()));

-- Normaliza los nombres externos antes de crear el perfil.
create or replace function private.handle_new_user()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    left(coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(btrim(split_part(new.email, '@', 1)), ''),
      'Usuario'
    ), 80),
    case when new.raw_user_meta_data ->> 'avatar_url' like 'https://lh3.googleusercontent.com/%'
      and new.raw_app_meta_data ->> 'provider' = 'google'
      then new.raw_user_meta_data ->> 'avatar_url' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Devuelve los identificadores de medios para la limpieza en Cloudinary.
create or replace function public.delete_group(p_group_id uuid)
returns text[] language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_found uuid;
  v_avatar text;
  v_assets text[] := '{}';
  v_ids text[];
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  -- Check authorization before existence so a non-member cannot probe
  -- group ids, and so a missing group is indistinguishable from a group
  -- the caller does not administer.
  if not (select private.is_group_admin(p_group_id)) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  select g.id, g.avatar_public_id into v_found, v_avatar
  from public.groups g where g.id = p_group_id for update;
  if v_found is null then
    raise exception 'group not found' using errcode = 'P0002';
  end if;
  -- Serialize with concurrent membership changes before collecting assets.
  if not private.is_group_admin(p_group_id) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  perform 1 from public.events where group_id = p_group_id order by id for update;

  if v_avatar is not null then
    v_assets := v_assets || v_avatar;
  end if;
  select coalesce(
    array_agg(e.cover_public_id order by e.id)
      filter (where e.cover_public_id is not null),
    '{}'::text[]
  ) into v_ids
  from public.events e where e.group_id = p_group_id;
  v_assets := v_assets || v_ids;
  select coalesce(
    array_agg(p.cloudinary_public_id order by p.id),
    '{}'::text[]
  ) into v_ids
  from public.photos p where p.group_id = p_group_id;
  v_assets := v_assets || v_ids;

  -- Cascades to events, members, photos, expenses, tasks, polls, etc.
  v_assets := v_assets || private.remove_group_receipt_expenses(p_group_id);
  delete from public.groups where id = p_group_id;
  return v_assets;
end;
$$;

-- Conserva el historial financiero al suprimir una cuenta.
create or replace function public.delete_my_account()
returns table (
  deleted_avatar_public_id text,
  deleted_group_avatars text[],
  deleted_event_covers text[],
  deleted_photos text[]
) language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_avatar text;
  v_group_avatars text[] := '{}';
  v_event_covers text[] := '{}';
  v_photos text[] := '{}';
  v_group_ids uuid[];
  v_group_id uuid;
  v_group_avatar text;
  v_ids text[];
  v_successor uuid;
  v_has_expense_history boolean;
begin
  if v_uid is null or not private.active_profile() then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select p.avatar_public_id into v_avatar
  from public.profiles p where p.id = v_uid;

  -- Groups where the caller is the sole administrator.
  select coalesce(array_agg(g.id order by g.id), '{}'::uuid[])
  into v_group_ids
  from public.groups g
  where exists (
    select 1 from public.group_members me
    where me.group_id = g.id and me.user_id = v_uid and me.role = 'admin'
  ) and not exists (
    select 1 from public.group_members other
    where other.group_id = g.id and other.user_id <> v_uid and other.role = 'admin'
  );

  foreach v_group_id in array v_group_ids loop
    select g.avatar_public_id into v_group_avatar
    from public.groups g where g.id = v_group_id for update;
    if not found then
      continue;
    end if;

    select gm.user_id into v_successor
    from public.group_members gm
    where gm.group_id = v_group_id and gm.user_id <> v_uid
    order by gm.joined_at asc, gm.user_id asc
    limit 1;

    if v_successor is not null then
      -- Two admins exist after this update, so the guard lets the
      -- caller's membership go below.
      update public.group_members set role = 'admin'
      where group_id = v_group_id and user_id = v_successor;
    else
      -- Bloquea las salidas y recoge sus medios antes de borrar el grupo.
      perform 1 from public.events where group_id = v_group_id order by id for update;
      if v_group_avatar is not null then
        v_group_avatars := v_group_avatars || v_group_avatar;
      end if;
      select coalesce(
        array_agg(e.cover_public_id order by e.id)
          filter (where e.cover_public_id is not null),
        '{}'::text[]
      ) into v_ids
      from public.events e where e.group_id = v_group_id;
      v_event_covers := v_event_covers || v_ids;
      select coalesce(
        array_agg(p.cloudinary_public_id order by p.id),
        '{}'::text[]
      ) into v_ids
      from public.photos p where p.group_id = v_group_id;
      v_photos := v_photos || v_ids;
      v_photos := v_photos || private.remove_group_receipt_expenses(v_group_id);
      delete from public.groups where id = v_group_id;
    end if;
  end loop;

  -- paid_by and expense_splits.user_id are ON DELETE RESTRICT: a balance
  -- with an unknown payer is unresolvable, so accounts with expense
  -- history are anonymized even when the user already left the group.
  select exists (select 1 from public.expenses where paid_by = v_uid)
      or exists (select 1 from public.expense_splits where user_id = v_uid)
  into v_has_expense_history;

  -- Leave every remaining group. Sole-admin groups now have two admins,
  -- and groups with another admin keep at least one, so the guard passes.
  delete from public.group_members where user_id = v_uid;

  if v_has_expense_history then
    update public.profiles
    set display_name = 'Cuenta eliminada',
        username = null,
        avatar_url = null,
        avatar_public_id = null
    where id = v_uid;
    -- Revoca sesiones e identidades antes de desactivar el registro de Auth.
    delete from auth.refresh_tokens where user_id = v_uid::text;
    delete from auth.sessions where user_id = v_uid;
    delete from auth.identities where user_id = v_uid;
    update auth.users
    set email = 'deleted-' || v_uid::text || '@deleted.invalid',
        encrypted_password = '',
        email_change = '',
        raw_user_meta_data = '{}'::jsonb,
        banned_until = 'infinity'
    where id = v_uid;
  else
    -- Cascades to public.profiles and every membership/profile FK.
    delete from auth.users where id = v_uid;
  end if;

  return query
  select v_avatar, v_group_avatars, v_event_covers, v_photos;
end;
$$;
