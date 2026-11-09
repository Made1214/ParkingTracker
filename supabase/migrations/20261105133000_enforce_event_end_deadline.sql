-- Enforce the end deadline even before the next cron run, and keep drafts read-only.
-- The same access rules apply to direct Data API writes as to app actions.
alter policy tasks_insert on public.tasks with check (
  (select private.is_group_member(group_id)) and created_by = (select auth.uid())
  and exists (select 1 from public.events e where e.id = tasks.event_id and e.group_id = tasks.group_id and e.status = 'published' and e.ends_at > now())
  and (assignee_id is null or exists (select 1 from public.group_members m where m.group_id = tasks.group_id and m.user_id = tasks.assignee_id))
);
alter policy tasks_update on public.tasks using (
  (select private.is_group_member(group_id))
  and (created_by = (select auth.uid()) or assignee_id = (select auth.uid()) or (select private.is_group_admin(group_id)))
  and exists (select 1 from public.events e where e.id = tasks.event_id and e.group_id = tasks.group_id and e.status = 'published' and e.ends_at > now())
) with check (
  (select private.is_group_member(group_id))
  and exists (select 1 from public.events e where e.id = tasks.event_id and e.group_id = tasks.group_id and e.status = 'published' and e.ends_at > now())
  and (assignee_id is null or exists (select 1 from public.group_members m where m.group_id = tasks.group_id and m.user_id = tasks.assignee_id))
);
alter policy tasks_delete on public.tasks using (
  (select private.is_group_member(group_id))
  and (created_by = (select auth.uid()) or (select private.is_group_admin(group_id)))
  and exists (select 1 from public.events e where e.id = tasks.event_id and e.group_id = tasks.group_id and e.status = 'published' and e.ends_at > now())
);



create or replace function public.create_poll(p_event_id uuid, p_question text, p_options text[], p_allow_multiple boolean, p_closes_at timestamptz)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_event public.events%rowtype; v_poll uuid; v_option text; v_position int := 0;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select * into v_event from public.events where id = p_event_id for share;
  if not found or not private.is_group_member(v_event.group_id) then raise exception 'event not found' using errcode = '42501'; end if;
  if (v_event.status <> 'published' or v_event.ends_at <= clock_timestamp()) then raise exception 'event is closed' using errcode = '55000'; end if;
  if p_question is null or length(trim(p_question)) not between 1 and 200 or p_closes_at is null or p_closes_at <= clock_timestamp()
    or coalesce(array_length(p_options, 1), 0) not between 2 and 10 or p_allow_multiple is null then
    raise exception 'invalid poll' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(p_options) x where x is null or length(trim(x)) not between 1 and 100)
    or (select count(distinct trim(x)) from unnest(p_options) x) <> cardinality(p_options) then
    raise exception 'invalid options' using errcode = '22023';
  end if;
  insert into public.polls(group_id, event_id, question, allow_multiple, closes_at, created_by)
    values(v_event.group_id, v_event.id, trim(p_question), p_allow_multiple, p_closes_at, auth.uid()) returning id into v_poll;
  foreach v_option in array p_options loop
    insert into public.poll_options(group_id, poll_id, label, position) values(v_event.group_id, v_poll, trim(v_option), v_position);
    v_position := v_position + 1;
  end loop;
  return v_poll;
end $$;

create or replace function public.cast_vote(p_poll_id uuid, p_option_ids uuid[])
returns void language plpgsql security definer set search_path = '' as $$
declare v_poll public.polls%rowtype; v_event public.events%rowtype; v_count int;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  -- Lock event before poll in all RPCs, serializing with event and poll closure.
  select e.* into v_event from public.events e join public.polls p on p.event_id = e.id where p.id = p_poll_id for share of e;
  select * into v_poll from public.polls where id = p_poll_id for update;
  if v_poll.id is null or not private.is_group_member(v_poll.group_id) then raise exception 'poll not found' using errcode = '42501'; end if;
  if (v_event.status <> 'published' or v_event.ends_at <= clock_timestamp()) or v_poll.status <> 'open' or (v_poll.closes_at is not null and v_poll.closes_at <= clock_timestamp()) then
    raise exception 'poll is closed' using errcode = '55000'; end if;
  v_count := coalesce(cardinality(p_option_ids), 0);
  if v_count < 1 or (not v_poll.allow_multiple and v_count <> 1)
    or (select count(distinct x) from unnest(p_option_ids) x) <> v_count
    or exists (select 1 from unnest(p_option_ids) x where not exists (select 1 from public.poll_options o where o.id = x and o.poll_id = p_poll_id)) then
    raise exception 'invalid options' using errcode = '22023'; end if;
  delete from public.poll_votes where poll_id = p_poll_id and user_id = auth.uid();
  insert into public.poll_votes(group_id, poll_id, option_id, user_id)
    select v_poll.group_id, p_poll_id, x, auth.uid() from unnest(p_option_ids) x;
end $$;

create or replace function public.close_poll(p_poll_id uuid) returns void language plpgsql security definer set search_path = '' as $$
declare v_poll public.polls%rowtype; v_event public.events%rowtype;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select e.* into v_event from public.events e join public.polls p on p.event_id = e.id where p.id = p_poll_id for share of e;
  select * into v_poll from public.polls where id = p_poll_id for update;
  if v_poll.id is null or not private.is_group_member(v_poll.group_id) or
    (v_poll.created_by is distinct from auth.uid() and not private.is_group_admin(v_poll.group_id)) then
    raise exception 'not authorized' using errcode = '42501'; end if;
  if (v_event.status <> 'published' or v_event.ends_at <= clock_timestamp()) then raise exception 'event is closed' using errcode = '55000'; end if;
  update public.polls set status = 'closed' where id = p_poll_id;
end $$;

create or replace function public.create_activity_proposal(p_event_id uuid, p_title text, p_description text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_event public.events%rowtype;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select * into v_event from public.events where id = p_event_id for share;
  if not found or not private.is_group_member(v_event.group_id) then raise exception 'event not found' using errcode = '42501'; end if;
  if (v_event.status <> 'published' or v_event.ends_at <= clock_timestamp()) then raise exception 'event is closed' using errcode = '55000'; end if;
  if p_title is null or length(trim(p_title)) not between 1 and 120 or length(p_description) > 2000 then
    raise exception 'invalid proposal' using errcode = '22023'; end if;
  insert into public.activity_proposals(group_id, event_id, title, description, created_by)
  values(v_event.group_id, v_event.id, trim(p_title), nullif(trim(p_description), ''), auth.uid());
end $$;
