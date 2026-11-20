-- Borra una salida en borrador y devuelve los medios que se deben limpiar.
create function public.delete_event_draft(p_group_id uuid, p_event_id uuid)
returns text[] language plpgsql security definer set search_path = '' as $$
declare e public.events; assets text[];
begin
  if auth.uid() is null or not private.is_group_member(p_group_id) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  select * into e from public.events where id = p_event_id and group_id = p_group_id for update;
  if not found or e.status <> 'draft' or not private.is_group_member(p_group_id)
    or (e.created_by is distinct from auth.uid() and not private.is_group_admin(p_group_id)) then
    raise exception 'draft not found' using errcode = '42501';
  end if;
  if exists (select 1 from public.expenses where event_id = p_event_id) then
    raise exception 'draft has expenses' using errcode = '22023';
  end if;
  perform 1 from public.receipts where event_id = p_event_id order by id for update;
  select array(select image_public_id from public.receipts
      where event_id = p_event_id and image_public_id is not null
    union all select cloudinary_public_id from public.photos where event_id = p_event_id
    union all select e.cover_public_id where e.cover_public_id is not null)
  into assets;
  delete from public.events where id = p_event_id;
  return assets;
end;
$$;

-- Asigna una tarea libre a la persona autenticada con una única escritura.
create function public.claim_task(p_group_id uuid, p_event_id uuid, p_task_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_user uuid := (select auth.uid());
begin
  if v_user is null or not private.is_group_member(p_group_id) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  perform 1 from public.events where id = p_event_id and group_id = p_group_id
    and status = 'published' and ends_at > now() for share;
  if not found then return false; end if;
  update public.tasks set assignee_id = v_user
  where id = p_task_id and group_id = p_group_id and event_id = p_event_id
    and assignee_id is null and status <> 'done';
  return found;
end;
$$;

-- Actualiza un gasto manual y su reparto en la misma transacción.
create function public.update_manual_expense(
  p_expense_id uuid, p_event_id uuid, p_description text, p_amount numeric,
  p_paid_by uuid, p_category text, p_shares jsonb
) returns void language plpgsql security definer set search_path = '' as $$
declare e public.expenses; v_event public.events;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select * into v_event from public.events where id = p_event_id for share;
  if not found or not private.is_group_member(v_event.group_id) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if v_event.status = 'cancelled' then
    raise exception 'event is cancelled' using errcode = '23514';
  end if;
  select * into e from public.expenses where id = p_expense_id
    and event_id = p_event_id and receipt_id is null for update;
  if not found or (e.created_by is distinct from auth.uid() and not private.is_group_admin(e.group_id)) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if exists (select 1 from public.expense_splits where expense_id = e.id
              and settled and user_id <> e.paid_by)
    or exists (select 1 from public.expense_guest_shares where expense_id = e.id) then
    raise exception 'expense has settled payments or guests' using errcode = '22023';
  end if;
  if jsonb_typeof(p_shares) is distinct from 'array' or jsonb_array_length(p_shares) = 0 then
    raise exception 'an expense needs participants' using errcode = '22023';
  end if;
  if not exists (select 1 from public.group_members m where m.group_id = e.group_id and m.user_id = p_paid_by) then
    raise exception 'payer must be a group member' using errcode = '23514';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_shares) s where not exists (
      select 1 from public.group_members m where m.group_id = e.group_id and m.user_id = (s->>'user_id')::uuid
    )
  ) then raise exception 'participant must be a group member' using errcode = '23514'; end if;
  update public.expenses set description = p_description, amount = p_amount,
    paid_by = p_paid_by, category = p_category where id = e.id;
  if not found then raise exception 'not authorized' using errcode = '42501'; end if;
  delete from public.expense_splits where expense_id = e.id;
  insert into public.expense_splits (group_id, expense_id, user_id, share_amount)
  select e.group_id, e.id, (s->>'user_id')::uuid, (s->>'amount')::numeric
  from jsonb_array_elements(p_shares) s;
  if (select sum(share_amount) from public.expense_splits where expense_id = e.id)
    is distinct from (select amount from public.expenses where id = e.id) then
    raise exception 'expense shares must add up to the amount' using errcode = '23514';
  end if;
end;
$$;

revoke all on function public.delete_event_draft(uuid, uuid), public.claim_task(uuid, uuid, uuid),
  public.update_manual_expense(uuid, uuid, text, numeric, uuid, text, jsonb) from public, anon;
grant execute on function public.delete_event_draft(uuid, uuid), public.claim_task(uuid, uuid, uuid),
  public.update_manual_expense(uuid, uuid, text, numeric, uuid, text, jsonb) to authenticated;

-- Impide editar o borrar invitados si ya se canceló la salida.
alter policy event_guests_update on public.event_guests with check (
  (select private.is_group_member(group_id))
  and exists (select 1 from public.events e where e.id = event_guests.event_id and e.status <> 'cancelled')
);
alter policy event_guests_delete on public.event_guests using (
  (created_by = (select auth.uid()) or (select private.is_group_admin(group_id)))
  and exists (select 1 from public.events e where e.id = event_guests.event_id and e.status <> 'cancelled')
);
