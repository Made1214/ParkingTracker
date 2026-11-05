-- The database, including direct PostgREST clients, enforces PRD US-04.
alter policy event_attendance_insert on public.event_attendance
with check (
  (select private.is_group_member(group_id))
  and user_id = (select auth.uid())
  and exists (select 1 from public.events e
    where e.id = event_id and e.group_id = event_attendance.group_id
      and e.status = 'published' and e.starts_at > now())
);
alter policy event_attendance_update on public.event_attendance
with check (
  (select private.is_group_member(group_id))
  and user_id = (select auth.uid())
  and exists (select 1 from public.events e
    where e.id = event_id and e.group_id = event_attendance.group_id
      and e.status = 'published' and e.starts_at > now())
);

-- An existing response cannot be moved onto another event through UPDATE.
create function private.keep_attendance_identity()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.event_id <> old.event_id or new.user_id <> old.user_id then
    raise exception 'attendance identity is immutable' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke execute on function private.keep_attendance_identity() from public, anon, authenticated;
create trigger attendance_identity_immutable before update on public.event_attendance
for each row execute function private.keep_attendance_identity();
