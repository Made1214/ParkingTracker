-- Sonda de Postgres para el cron. Expone solo una constante.
create function public.database_healthcheck()
returns boolean
language sql stable security invoker set search_path = '' as $$
  select true;
$$;

revoke all on function public.database_healthcheck() from public;
grant usage on schema public to anon;
grant execute on function public.database_healthcheck() to anon, authenticated;
