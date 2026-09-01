-- 008_events.sql
create table public.events (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups(id) on delete cascade,
  title       text not null check (length(trim(title)) between 1 and 120),
  description text,
  location    text,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  status      public.event_status not null default 'draft',
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint events_time_order check (ends_at > starts_at)
);

-- The composite key every child table's tenant-integrity FK points at.
alter table public.events add constraint events_id_group_uk unique (id, group_id);

alter table public.events enable row level security;
alter table public.events force  row level security;

create policy events_select on public.events for select to authenticated
  using ((select private.is_group_member(group_id)));

create policy events_insert on public.events for insert to authenticated
  with check ((select private.is_group_member(group_id)) and created_by = (select auth.uid()));

create policy events_update on public.events for update to authenticated
  using (created_by = (select auth.uid()) or (select private.is_group_admin(group_id)))
  with check ((select private.is_group_member(group_id)));

create policy events_delete on public.events for delete to authenticated
  using (created_by = (select auth.uid()) or (select private.is_group_admin(group_id)));

create trigger events_set_updated_at
  before update on public.events
  for each row execute function private.set_updated_at();

create trigger events_group_id_immutable
  before update of group_id on public.events
  for each row execute function private.reject_group_id_change();

-- Every list screen filters "events of my group, soonest first".
create index events_group_id_starts_at_idx on public.events (group_id, starts_at);
