-- The same access rules apply to direct Data API writes as to app actions.
alter policy tasks_insert on public.tasks with check (
  (select private.is_group_member(group_id)) and created_by = (select auth.uid())
  and exists (select 1 from public.events e where e.id = tasks.event_id and e.group_id = tasks.group_id and e.status not in ('finished', 'cancelled'))
  and (assignee_id is null or exists (select 1 from public.group_members m where m.group_id = tasks.group_id and m.user_id = tasks.assignee_id))
);
alter policy tasks_update on public.tasks using (
  (select private.is_group_member(group_id))
  and (created_by = (select auth.uid()) or assignee_id = (select auth.uid()) or (select private.is_group_admin(group_id)))
  and exists (select 1 from public.events e where e.id = tasks.event_id and e.group_id = tasks.group_id and e.status not in ('finished', 'cancelled'))
) with check (
  (select private.is_group_member(group_id))
  and exists (select 1 from public.events e where e.id = tasks.event_id and e.group_id = tasks.group_id and e.status not in ('finished', 'cancelled'))
  and (assignee_id is null or exists (select 1 from public.group_members m where m.group_id = tasks.group_id and m.user_id = tasks.assignee_id))
);
alter policy tasks_delete on public.tasks using (
  (select private.is_group_member(group_id))
  and (created_by = (select auth.uid()) or (select private.is_group_admin(group_id)))
  and exists (select 1 from public.events e where e.id = tasks.event_id and e.group_id = tasks.group_id and e.status not in ('finished', 'cancelled'))
);

-- Neither creators, assignees nor admins can transfer ownership or move a task.
-- Referential actions and privileged maintenance continue to work.
create function private.guard_task_identity() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated' and (
    new.id is distinct from old.id or new.group_id is distinct from old.group_id
    or new.event_id is distinct from old.event_id or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'task identity is immutable' using errcode = '23514';
  end if;
  if current_user = 'authenticated'
    and old.created_by is distinct from auth.uid()
    and not private.is_group_admin(old.group_id)
    and (new.title is distinct from old.title or new.due_at is distinct from old.due_at) then
    raise exception 'assignee can only change status and assignment' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function private.guard_task_identity() from public, anon, authenticated;
create trigger tasks_guard_identity before update on public.tasks
for each row execute function private.guard_task_identity();
