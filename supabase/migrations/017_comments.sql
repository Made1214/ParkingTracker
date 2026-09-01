-- 018_comments.sql
create table public.comments (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null,
  event_id   uuid not null,
  parent_id  uuid,
  body       text not null check (length(trim(body)) between 1 and 2000),
  author_id  uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Derived flag: true once this row has a parent (i.e. it is itself a
  -- reply). Used only for readability/introspection; one-level nesting
  -- is enforced by the trigger below, not by a generated-column FK --
  -- Postgres composite FKs cannot express "target row's own flag must be
  -- false", only "target row exists with these exact values", so a
  -- BEFORE INSERT/UPDATE trigger is the correct tool here (this is the
  -- one place in the schema where a trigger, not a declarative
  -- constraint, is the right call).
  is_reply   boolean generated always as (parent_id is not null) stored,
  constraint c_event_fk foreign key (event_id, group_id)
    references public.events (id, group_id) on delete cascade,
  constraint c_parent_fk foreign key (parent_id) references public.comments (id) on delete cascade,
  constraint c_not_self check (parent_id is distinct from id)
);

-- Enforces one level of nesting: a reply's parent must itself be a root
-- comment (parent_id is null on the parent). Runs on every insert and on
-- any later reparenting.
create or replace function private.reject_nested_reply()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_parent_is_reply boolean;
begin
  if new.parent_id is not null then
    select is_reply into v_parent_is_reply from public.comments where id = new.parent_id;
    if v_parent_is_reply is true then
      raise exception 'comments support only one level of nesting' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger comments_reject_nested_reply
  before insert or update of parent_id on public.comments
  for each row execute function private.reject_nested_reply();

alter table public.comments enable row level security;
alter table public.comments force  row level security;

create policy comments_select on public.comments for select to authenticated
  using ((select private.is_group_member(group_id)));

create policy comments_insert on public.comments for insert to authenticated
  with check ((select private.is_group_member(group_id)) and author_id = (select auth.uid()));

create policy comments_update on public.comments for update to authenticated
  using (author_id = (select auth.uid()))
  with check ((select private.is_group_member(group_id)));

create policy comments_delete on public.comments for delete to authenticated
  using (author_id = (select auth.uid()) or (select private.is_group_admin(group_id)));

create trigger comments_set_updated_at
  before update on public.comments
  for each row execute function private.set_updated_at();

create trigger comments_group_id_immutable
  before update of group_id on public.comments
  for each row execute function private.reject_group_id_change();

create index comments_event_id_idx  on public.comments (event_id);
create index comments_parent_id_idx on public.comments (parent_id);
