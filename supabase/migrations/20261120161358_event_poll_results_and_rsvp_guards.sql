-- Calcula los resultados de todas las votaciones de la salida en una consulta.
create function public.get_event_poll_results(p_event_id uuid)
returns table (poll_id uuid, option_id uuid, label text, votes bigint, is_winner boolean)
language sql stable security invoker set search_path = '' as $$
  with counts as (
    select p.id as poll_id, o.id as option_id, o.label, count(v.id) as votes
    from public.polls p
    join public.poll_options o on o.poll_id = p.id
    left join public.poll_votes v on v.option_id = o.id
    where p.event_id = p_event_id
    group by p.id, o.id
  )
  select c.poll_id, c.option_id, c.label, c.votes,
    c.votes = max(c.votes) over (partition by c.poll_id)
  from counts c
  order by c.votes desc, c.label, c.option_id;
$$;

revoke all on function public.get_event_poll_results(uuid) from public, anon;
grant execute on function public.get_event_poll_results(uuid) to authenticated;

-- Cerrar el plazo impide también borrar una confirmación anterior.
alter policy event_attendance_delete on public.event_attendance using (
  (user_id = (select auth.uid()) or (select private.is_group_admin(group_id)))
  and (select private.is_group_member(group_id))
  and exists (
    select 1 from public.events e
    where e.id = event_id and e.group_id = event_attendance.group_id
      and e.status = 'published' and e.starts_at > now()
  )
);

-- La galería no cambia después de cancelar la salida.
alter policy photos_delete on public.photos using (
  (uploaded_by = (select auth.uid()) or (select private.is_group_admin(group_id)))
  and exists (
    select 1 from public.events e where e.id = photos.event_id and e.group_id = photos.group_id
      and e.status in ('published', 'finished')
  )
);

create index photos_event_cursor_idx on public.photos (event_id, created_at desc, id desc);
