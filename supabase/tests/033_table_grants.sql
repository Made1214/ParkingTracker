begin;
select plan(9);

-- anon no tiene nada en el esquema public: ni el esquema, ni tablas, vistas,
-- secuencias o funciones.
-- Se mira el permiso directo de anon, no `has_schema_privilege`: Postgres 15+
-- da USAGE sobre `public` a PUBLIC y anon lo heredaría aunque la migración se lo
-- haya quitado (en Staging ese permiso de PUBLIC ya no existe, en el stack local
-- sí). Sin permisos de tabla, ese USAGE heredado no da acceso a nada.
select ok(
  not exists (
    select 1
    from pg_namespace n, aclexplode(n.nspacl) a
    where n.nspname = 'public'
      and a.grantee = (select oid from pg_roles where rolname = 'anon')
      and a.privilege_type = 'USAGE'
  ),
  'anon has no direct USAGE grant on schema public'
);
select is(
  (select count(*) from pg_class c
    where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'v', 'm', 'p')
      and has_table_privilege('anon', c.oid,
        'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')),
  0::bigint,
  'anon has no privilege on any table or view in public'
);
select is(
  (select count(*) from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and has_function_privilege('anon', p.oid, 'EXECUTE')),
  0::bigint,
  'anon cannot execute any function in public'
);

-- authenticated no puede saltarse RLS: TRUNCATE no pasa por ella.
select is(
  (select count(*) from pg_class c
    where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'v', 'm', 'p')
      and has_table_privilege('authenticated', c.oid, 'TRUNCATE,REFERENCES,TRIGGER')),
  0::bigint,
  'authenticated has no TRUNCATE, REFERENCES or TRIGGER on any table'
);

-- Lo que la app necesita sigue en pie.
select ok(
  has_table_privilege('authenticated', 'public.groups', 'SELECT')
  and has_table_privilege('authenticated', 'public.groups', 'INSERT')
  and has_table_privilege('authenticated', 'public.groups', 'UPDATE')
  and has_table_privilege('authenticated', 'public.groups', 'DELETE'),
  'authenticated keeps SELECT, INSERT, UPDATE and DELETE on its tables'
);
-- Las restricciones deliberadas por tabla no se ensancharon.
select ok(
  not has_table_privilege('authenticated', 'public.polls', 'INSERT')
  and not has_table_privilege('authenticated', 'public.poll_votes', 'UPDATE'),
  'polls and votes stay write-protected for authenticated (RPC only)'
);

-- Una tabla futura nace con los permisos correctos.
create table public._grant_probe (id int primary key);
select ok(
  not has_table_privilege('anon', 'public._grant_probe', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE'),
  'a new table is not readable or writable by anon'
);
select ok(
  not has_table_privilege('authenticated', 'public._grant_probe', 'TRUNCATE,REFERENCES,TRIGGER'),
  'a new table gives authenticated no TRUNCATE, REFERENCES or TRIGGER'
);
select ok(
  has_table_privilege('authenticated', 'public._grant_probe', 'SELECT,INSERT,UPDATE,DELETE'),
  'a new table still gives authenticated DML (RLS narrows the rows)'
);

select * from finish();
rollback;
