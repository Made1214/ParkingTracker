-- A poll can remain open until manual closure or event completion.
create or replace function public.create_poll(p_event_id uuid, p_question text, p_options text[], p_allow_multiple boolean, p_closes_at timestamptz default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_event public.events%rowtype; v_poll uuid; v_option text; v_position int := 0;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select * into v_event from public.events where id = p_event_id for share;
  if not found or not private.is_group_member(v_event.group_id) then raise exception 'event not found' using errcode = '42501'; end if;
  if (v_event.status <> 'published' or v_event.ends_at <= clock_timestamp()) then raise exception 'event is closed' using errcode = '55000'; end if;
  if p_question is null or length(trim(p_question)) not between 1 and 200 or (p_closes_at is not null and p_closes_at <= clock_timestamp())
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
