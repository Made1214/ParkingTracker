-- 013_poll_votes.sql
-- PERSONAL RECORD table.
create table public.poll_votes (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null,
  poll_id    uuid not null,
  option_id  uuid not null,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint pv_poll_fk foreign key (poll_id, group_id)
    references public.polls (id, group_id) on delete cascade,
  -- Proves the option belongs to THIS poll, not merely to this group --
  -- otherwise a vote could record an option_id borrowed from a sibling
  -- poll in the same group.
  constraint pv_option_fk foreign key (option_id, poll_id)
    references public.poll_options (id, poll_id) on delete cascade,
  constraint pv_one_per_option unique (poll_id, user_id, option_id)
);

alter table public.poll_votes enable row level security;
alter table public.poll_votes force  row level security;

create policy poll_votes_select on public.poll_votes for select to authenticated
  using ((select private.is_group_member(group_id)));

create policy poll_votes_insert on public.poll_votes for insert to authenticated
  with check ((select private.is_group_member(group_id)) and user_id = (select auth.uid()));

create policy poll_votes_delete on public.poll_votes for delete to authenticated
  using (user_id = (select auth.uid()));

-- No UPDATE policy: cast_vote() below replaces a vote by delete+insert in
-- one transaction, which is the only supported way to change a vote.

create trigger poll_votes_group_id_immutable
  before update of group_id on public.poll_votes
  for each row execute function private.reject_group_id_change();

create index poll_votes_poll_id_idx   on public.poll_votes (poll_id);
create index poll_votes_user_id_idx   on public.poll_votes (user_id);
create index poll_votes_option_id_idx on public.poll_votes (option_id);

-- ---------------------------------------------------------------------
-- RPCs

create or replace function public.cast_vote(p_poll_id uuid, p_option_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id       uuid := (select auth.uid());
  v_group_id      uuid;
  v_allow_multi   boolean;
  v_status        public.poll_status;
  v_closes_at     timestamptz;
  v_option_count  int;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select group_id, allow_multiple, status, closes_at
    into v_group_id, v_allow_multi, v_status, v_closes_at
  from public.polls
  where id = p_poll_id;

  if v_group_id is null then
    raise exception 'poll not found' using errcode = 'P0002';
  end if;
  if not private.is_group_member(v_group_id) then
    raise exception 'not a member of this group' using errcode = '42501';
  end if;
  if v_status <> 'open' or (v_closes_at is not null and v_closes_at <= now()) then
    raise exception 'poll is closed' using errcode = '55000';
  end if;

  v_option_count := coalesce(array_length(p_option_ids, 1), 0);
  if v_option_count = 0 then
    raise exception 'at least one option required' using errcode = '22023';
  end if;
  if not v_allow_multi and v_option_count > 1 then
    raise exception 'this poll only allows a single choice' using errcode = '22023';
  end if;

  -- Every option must belong to this exact poll.
  if exists (
    select 1 from unnest(p_option_ids) o(option_id)
    where not exists (
      select 1 from public.poll_options po
      where po.id = o.option_id and po.poll_id = p_poll_id
    )
  ) then
    raise exception 'option does not belong to this poll' using errcode = '23503';
  end if;

  -- Delete-then-insert in one transaction: a changed vote is never
  -- observed as double-counted.
  delete from public.poll_votes where poll_id = p_poll_id and user_id = v_user_id;

  insert into public.poll_votes (group_id, poll_id, option_id, user_id)
  select v_group_id, p_poll_id, o.option_id, v_user_id
  from unnest(p_option_ids) o(option_id);
end;
$$;

create or replace function public.get_poll_results(p_poll_id uuid)
returns table (option_id uuid, label text, votes bigint, is_winner boolean)
language sql
stable
security invoker
set search_path = ''
as $$
  with counts as (
    select po.id as option_id, po.label, count(pv.id) as votes
    from public.poll_options po
    left join public.poll_votes pv on pv.option_id = po.id
    where po.poll_id = p_poll_id
    group by po.id, po.label
  ),
  ranked as (
    select *, votes = max(votes) over () as is_winner
    from counts
  )
  select option_id, label, votes, is_winner from ranked order by votes desc, label asc;
$$;

revoke execute on function public.cast_vote(uuid, uuid[])   from public, anon;
revoke execute on function public.get_poll_results(uuid)     from public, anon;
grant  execute on function public.cast_vote(uuid, uuid[])   to authenticated;
grant  execute on function public.get_poll_results(uuid)     to authenticated;
