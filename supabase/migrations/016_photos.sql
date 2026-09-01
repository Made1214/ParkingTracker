-- 017_photos.sql
create table public.photos (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null,
  event_id     uuid not null,
  storage_path text not null unique,
  thumb_path   text,
  bytes        bigint not null check (bytes > 0 and bytes <= 10485760), -- 10 MB, PRD US-08
  width        integer,
  height       integer,
  uploaded_by  uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  constraint photos_event_fk foreign key (event_id, group_id)
    references public.events (id, group_id) on delete cascade
);

alter table public.photos enable row level security;
alter table public.photos force  row level security;

create policy photos_select on public.photos for select to authenticated
  using ((select private.is_group_member(group_id)));

create policy photos_insert on public.photos for insert to authenticated
  with check ((select private.is_group_member(group_id)) and uploaded_by = (select auth.uid()));

-- No UPDATE policy: photos are immutable once uploaded (PRD scope has no
-- edit-photo use case). Only delete: own photo, or admin removes any.
create policy photos_delete on public.photos for delete to authenticated
  using (uploaded_by = (select auth.uid()) or (select private.is_group_admin(group_id)));

create trigger photos_group_id_immutable
  before update of group_id on public.photos
  for each row execute function private.reject_group_id_change();

create index photos_event_id_idx on public.photos (event_id);

-- Per-group storage quota (PRD C3 / risk 10.1): 100 MB default.
create table public.group_storage_usage (
  group_id   uuid primary key references public.groups(id) on delete cascade,
  bytes_used bigint not null default 0 check (bytes_used >= 0),
  bytes_quota bigint not null default 104857600 -- 100 MB
);

alter table public.group_storage_usage enable row level security;
alter table public.group_storage_usage force  row level security;

create policy group_storage_usage_select on public.group_storage_usage for select to authenticated
  using ((select private.is_group_member(group_id)));
-- No client INSERT/UPDATE/DELETE: maintained only by the trigger below.

create or replace function private.enforce_photo_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_used  bigint;
  v_quota bigint;
begin
  insert into public.group_storage_usage (group_id, bytes_used)
  values (new.group_id, 0)
  on conflict (group_id) do nothing;

  select bytes_used, bytes_quota into v_used, v_quota
  from public.group_storage_usage where group_id = new.group_id
  for update;

  if v_used + new.bytes > v_quota then
    raise exception 'group storage quota exceeded (% + % > %)', v_used, new.bytes, v_quota
      using errcode = '53100';
  end if;

  update public.group_storage_usage
    set bytes_used = bytes_used + new.bytes
    where group_id = new.group_id;

  return new;
end;
$$;

create trigger photos_enforce_quota
  before insert on public.photos
  for each row execute function private.enforce_photo_quota();

create or replace function private.release_photo_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.group_storage_usage
    set bytes_used = greatest(0, bytes_used - old.bytes)
    where group_id = old.group_id;
  return old;
end;
$$;

create trigger photos_release_quota
  after delete on public.photos
  for each row execute function private.release_photo_quota();
