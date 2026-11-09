-- Keep direct API writes consistent with the event-management flow.
create function private.guard_event_changes() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user <> 'authenticated' then return new; end if;
  if tg_op = 'INSERT' then
    if new.status not in ('draft', 'published') or new.starts_at <= now() then
      raise exception 'invalid event state' using errcode = '23514';
    end if;
    return new;
  end if;
  if new.id is distinct from old.id or new.group_id is distinct from old.group_id
    or new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at then
    raise exception 'event identity is immutable' using errcode = '23514';
  end if;
  if old.status not in ('draft', 'published') or (old.status = 'published' and old.starts_at <= now()) then
    raise exception 'event can no longer be modified' using errcode = '23514';
  end if;
  if (old.status = 'draft' and new.status not in ('draft', 'published'))
    or (old.status = 'published' and new.status not in ('published', 'cancelled'))
    or (new.status = 'published' and new.starts_at <= now()) then
    raise exception 'invalid event state transition' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke execute on function private.guard_event_changes() from public, anon, authenticated;
create trigger events_guard_changes before insert or update on public.events
for each row execute function private.guard_event_changes();
