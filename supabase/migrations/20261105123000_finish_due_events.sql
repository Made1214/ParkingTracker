-- Finish published events after their end time, including when nobody opens the app.
create extension if not exists pg_cron;

create index events_due_for_completion_idx on public.events (ends_at)
  where status = 'published';

create function private.finish_due_events() returns void
language sql set search_path = '' as $$
  update public.events set status = 'finished'
  where status = 'published' and ends_at <= now();
$$;
revoke all on function private.finish_due_events() from public, anon, authenticated;

select cron.schedule('finish-due-events', '* * * * *',
  'select private.finish_due_events()');
