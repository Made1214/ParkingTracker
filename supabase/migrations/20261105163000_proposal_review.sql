create function public.review_activity_proposal(p_proposal_id uuid, p_status public.proposal_status)
returns void language plpgsql security definer set search_path = '' as $$
declare v_event public.events%rowtype; v_proposal public.activity_proposals%rowtype;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select e.* into v_event from public.events e join public.activity_proposals p on p.event_id=e.id where p.id=p_proposal_id for share of e;
  if not found or not private.is_group_member(v_event.group_id)
    or (v_event.created_by is distinct from auth.uid() and not private.is_group_admin(v_event.group_id)) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if v_event.status <> 'published' or v_event.ends_at <= clock_timestamp() then raise exception 'event is closed' using errcode = '55000'; end if;
  if p_status is null or p_status not in ('accepted','rejected') then raise exception 'invalid decision' using errcode = '22023'; end if;
  select * into v_proposal from public.activity_proposals where id=p_proposal_id for update;
  if not found then raise exception 'proposal not found' using errcode = '42501'; end if;
  update public.activity_proposals set status=p_status where id=p_proposal_id;
end;
$$;
revoke all on function public.review_activity_proposal(uuid,public.proposal_status) from public,anon;
grant execute on function public.review_activity_proposal(uuid,public.proposal_status) to authenticated;
