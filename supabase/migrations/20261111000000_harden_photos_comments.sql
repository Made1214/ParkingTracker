-- 20261111000000_harden_photos_comments.sql
-- Security hardening for gallery photos, event comments, and proposal policies:
-- 1.1 Scope photos.cloudinary_public_id to photos/{group_id}/{event_id}/{uuid}.
-- 1.2 Restrict comment updates to the body column only (immutable comment identity).
-- 1.3 Require replies to reference a root comment in the same group and event.
-- 1.4 Tighten photo dimension/size invariants against direct PostgREST inserts.
-- 1.5 Reject photo and comment mutations on draft or cancelled events.
-- 8.1 Wrap auth.uid() in a scalar subquery on activity_proposals_insert.

-- 1.1: Scope gallery asset references to the owning group and event.
-- NOT VALID allows existing dev/seed rows to remain until explicitly replaced,
-- while enforcing the tenant/event prefix on every new or updated row.
alter table public.photos
  add constraint photos_cloudinary_scope check (
    cloudinary_public_id ~ (
      '^photos/' || group_id::text || '/' || event_id::text || '/[0-9a-f-]{36}$'
    )
  ) not valid;

-- 1.4: Require positive dimensions when provided so malformed client metadata is rejected.
alter table public.photos
  add constraint photos_dimensions_positive check (
    (width is null or width > 0) and (height is null or height > 0)
  );

-- 1.5 (photos): Only published or finished events accept gallery photo mutations.
create or replace function private.guard_photo_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user <> 'authenticated' then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  if exists (
    select 1 from public.events e
    where e.id = coalesce(new.event_id, old.event_id)
      and e.status in ('draft', 'cancelled')
  ) then
    raise exception 'photos require a published or finished event'
      using errcode = '23514';
  end if;

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

revoke all on function private.guard_photo_write() from public, anon, authenticated;

create trigger photos_guard_event_status
  before insert or update or delete on public.photos
  for each row execute function private.guard_photo_write();

-- 1.2: Restrict authenticated updates on comments to the body column, and guard
-- identity columns + author ownership in a BEFORE INSERT OR UPDATE trigger.
revoke update on public.comments from authenticated;
grant update (body) on public.comments to authenticated;

drop policy comments_update on public.comments;
create policy comments_update on public.comments for update to authenticated
  using ((select private.is_group_member(group_id)) and author_id = (select auth.uid()))
  with check ((select private.is_group_member(group_id)) and author_id = (select auth.uid()));

-- 1.3: Replies must belong to the same group and event as their parent root comment.
create or replace function private.reject_nested_reply()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_parent_is_reply boolean;
  v_parent_group_id uuid;
  v_parent_event_id uuid;
begin
  if new.parent_id is not null then
    select is_reply, group_id, event_id
      into v_parent_is_reply, v_parent_group_id, v_parent_event_id
    from public.comments
    where id = new.parent_id;

    if v_parent_group_id is distinct from new.group_id
      or v_parent_event_id is distinct from new.event_id then
      raise exception 'reply parent must belong to the same event and group'
        using errcode = '23514';
    end if;

    if v_parent_is_reply is true then
      raise exception 'comments support only one level of nesting'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.reject_nested_reply() from public, anon, authenticated;

drop trigger comments_reject_nested_reply on public.comments;
create trigger comments_reject_nested_reply
  before insert or update of parent_id, event_id, group_id on public.comments
  for each row execute function private.reject_nested_reply();

-- 1.2 & 1.5 (comments): Guard comment identity on UPDATE and reject mutations
-- on draft or cancelled events.
create or replace function private.guard_comment_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user <> 'authenticated' then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id
      or new.group_id is distinct from old.group_id
      or new.event_id is distinct from old.event_id
      or new.parent_id is distinct from old.parent_id
      or new.author_id is distinct from old.author_id
      or new.created_at is distinct from old.created_at then
      raise exception 'comment identity is immutable'
        using errcode = '23514';
    end if;

    if old.author_id is distinct from (select auth.uid()) then
      raise exception 'only the author can edit a comment'
        using errcode = '42501';
    end if;
  end if;

  if exists (
    select 1 from public.events e
    where e.id = coalesce(new.event_id, old.event_id)
      and e.status in ('draft', 'cancelled')
  ) then
    raise exception 'comments require a published or finished event'
      using errcode = '23514';
  end if;

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

revoke all on function private.guard_comment_write() from public, anon, authenticated;

create trigger comments_guard_write
  before insert or update or delete on public.comments
  for each row execute function private.guard_comment_write();

-- 8.1: Evaluate auth.uid() and is_group_member(group_id) via InitPlans on activity_proposals_insert.
alter policy activity_proposals_insert on public.activity_proposals
  with check (
    (select private.is_group_member(group_id))
    and created_by = (select auth.uid())
    and exists (
      select 1 from public.events e
      where e.id = activity_proposals.event_id
        and e.group_id = activity_proposals.group_id
        and e.status not in ('finished', 'cancelled')
    )
  );
