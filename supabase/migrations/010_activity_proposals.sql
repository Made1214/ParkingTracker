-- 011_activity_proposals.sql
create table public.activity_proposals (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null,
  event_id    uuid not null,
  title       text not null check (length(trim(title)) between 1 and 120),
  description text,
  status      public.proposal_status not null default 'open',
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint ap_event_fk foreign key (event_id, group_id)
    references public.events (id, group_id) on delete cascade
);

alter table public.activity_proposals enable row level security;
alter table public.activity_proposals force  row level security;

create policy activity_proposals_select on public.activity_proposals for select to authenticated
  using ((select private.is_group_member(group_id)));

create policy activity_proposals_insert on public.activity_proposals for insert to authenticated
  with check ((select private.is_group_member(group_id)) and created_by = (select auth.uid()));

create policy activity_proposals_update on public.activity_proposals for update to authenticated
  using (created_by = (select auth.uid()) or (select private.is_group_admin(group_id)))
  with check ((select private.is_group_member(group_id)));

create policy activity_proposals_delete on public.activity_proposals for delete to authenticated
  using (created_by = (select auth.uid()) or (select private.is_group_admin(group_id)));

create trigger activity_proposals_set_updated_at
  before update on public.activity_proposals
  for each row execute function private.set_updated_at();

create trigger activity_proposals_group_id_immutable
  before update of group_id on public.activity_proposals
  for each row execute function private.reject_group_id_change();

create index activity_proposals_event_id_idx on public.activity_proposals (event_id);
