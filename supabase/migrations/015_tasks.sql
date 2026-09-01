-- 016_tasks.sql
create table public.tasks (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null,
  event_id    uuid not null,
  title       text not null check (length(trim(title)) between 1 and 120),
  assignee_id uuid references public.profiles(id) on delete set null,
  status      public.task_status not null default 'pending',
  due_at      timestamptz,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint tasks_event_fk foreign key (event_id, group_id)
    references public.events (id, group_id) on delete cascade
);

alter table public.tasks enable row level security;
alter table public.tasks force  row level security;

create policy tasks_select on public.tasks for select to authenticated
  using ((select private.is_group_member(group_id)));

create policy tasks_insert on public.tasks for insert to authenticated
  with check ((select private.is_group_member(group_id)) and created_by = (select auth.uid()));

-- Update is broader than the authorship default: the assignee needs to
-- flip status (pending -> in_progress -> done) without being the author.
create policy tasks_update on public.tasks for update to authenticated
  using (
    created_by  = (select auth.uid())
    or assignee_id = (select auth.uid())
    or (select private.is_group_admin(group_id))
  )
  with check ((select private.is_group_member(group_id)));

create policy tasks_delete on public.tasks for delete to authenticated
  using (created_by = (select auth.uid()) or (select private.is_group_admin(group_id)));

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function private.set_updated_at();

create trigger tasks_group_id_immutable
  before update of group_id on public.tasks
  for each row execute function private.reject_group_id_change();

create index tasks_event_id_idx    on public.tasks (event_id);
create index tasks_assignee_id_idx on public.tasks (assignee_id);
