-- Cronograma (US-05, RF-401/402/404).
-- Solo quien organiza la salida o un administrador del grupo gestiona sus
-- actividades, mientras la salida siga abierta (borrador o publicada y sin
-- terminar). Cada actividad cae dentro del horario de la salida. Una propuesta
-- aceptada puede convertirse en actividad una sola vez.

alter table public.activity_proposals
  add constraint ap_id_group_uk unique (id, group_id);

alter table public.schedule_items
  add column proposal_id uuid,
  add constraint si_proposal_fk foreign key (proposal_id, group_id)
    references public.activity_proposals (id, group_id) on delete set null (proposal_id);

create unique index schedule_items_proposal_id_key
  on public.schedule_items (proposal_id) where proposal_id is not null;

-- ¿Puede el usuario actual gestionar la salida? Organizador o admin, y salida abierta.
create function private.can_manage_schedule(p_event_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.events e
    where e.id = p_event_id
      and (select auth.uid()) is not null
      and private.is_group_member(e.group_id)
      and (e.created_by = (select auth.uid()) or private.is_group_admin(e.group_id))
      and e.status in ('draft', 'published')
      and e.ends_at > now()
  );
$$;
revoke execute on function private.can_manage_schedule(uuid) from public, anon;
grant execute on function private.can_manage_schedule(uuid) to authenticated;

drop policy schedule_items_insert on public.schedule_items;
drop policy schedule_items_update on public.schedule_items;
drop policy schedule_items_delete on public.schedule_items;

create policy schedule_items_insert on public.schedule_items for insert to authenticated
  with check (
    (select private.is_group_member(group_id))
    and created_by = (select auth.uid())
    and private.can_manage_schedule(event_id)
  );

create policy schedule_items_update on public.schedule_items for update to authenticated
  using ((select private.is_group_member(group_id)) and private.can_manage_schedule(event_id))
  with check ((select private.is_group_member(group_id)) and private.can_manage_schedule(event_id));

create policy schedule_items_delete on public.schedule_items for delete to authenticated
  using ((select private.is_group_member(group_id)) and private.can_manage_schedule(event_id));

-- Identidad inmutable, horario dentro de la salida y propuesta aceptada del mismo evento.
create function private.guard_schedule_item() returns trigger
language plpgsql set search_path = '' as $$
declare v_event public.events%rowtype; v_proposal public.activity_proposals%rowtype;
begin
  if current_user <> 'authenticated' then return new; end if;
  if tg_op = 'UPDATE' and (
    new.id is distinct from old.id or new.group_id is distinct from old.group_id
    or new.event_id is distinct from old.event_id or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at or new.proposal_id is distinct from old.proposal_id
  ) then
    raise exception 'schedule item identity is immutable' using errcode = '23514';
  end if;
  select * into v_event from public.events where id = new.event_id;
  if new.starts_at < v_event.starts_at or new.starts_at >= v_event.ends_at
    or (new.ends_at is not null and new.ends_at > v_event.ends_at) then
    raise exception 'schedule item must fall within the event' using errcode = '23514';
  end if;
  if tg_op = 'INSERT' and new.proposal_id is not null then
    select * into v_proposal from public.activity_proposals where id = new.proposal_id;
    if not found or v_proposal.event_id <> new.event_id or v_proposal.status <> 'accepted' then
      raise exception 'only accepted proposals of this event can be scheduled' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function private.guard_schedule_item() from public, anon, authenticated;
create trigger schedule_items_guard before insert or update on public.schedule_items
  for each row execute function private.guard_schedule_item();

create index schedule_items_event_start_idx on public.schedule_items (event_id, starts_at, position);
