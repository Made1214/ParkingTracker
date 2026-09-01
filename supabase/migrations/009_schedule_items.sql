-- 010_schedule_items.sql
create table public.schedule_items (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null,
  event_id    uuid not null,
  title       text not null check (length(trim(title)) between 1 and 120),
  description text,
  starts_at   timestamptz not null,
  ends_at     timestamptz,
  position    integer not null default 0,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint si_time_order check (ends_at is null or ends_at > starts_at),
  constraint si_event_fk foreign key (event_id, group_id)
    references public.events (id, group_id) on delete cascade
);

alter table public.schedule_items enable row level security;
alter table public.schedule_items force  row level security;

create policy schedule_items_select on public.schedule_items for select to authenticated
  using ((select private.is_group_member(group_id)));

create policy schedule_items_insert on public.schedule_items for insert to authenticated
  with check ((select private.is_group_member(group_id)) and created_by = (select auth.uid()));

create policy schedule_items_update on public.schedule_items for update to authenticated
  using (created_by = (select auth.uid()) or (select private.is_group_admin(group_id)))
  with check ((select private.is_group_member(group_id)));

create policy schedule_items_delete on public.schedule_items for delete to authenticated
  using (created_by = (select auth.uid()) or (select private.is_group_admin(group_id)));

create trigger schedule_items_set_updated_at
  before update on public.schedule_items
  for each row execute function private.set_updated_at();

create trigger schedule_items_group_id_immutable
  before update of group_id on public.schedule_items
  for each row execute function private.reject_group_id_change();

create index schedule_items_event_id_idx on public.schedule_items (event_id, position);
