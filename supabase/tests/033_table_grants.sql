begin;
select plan(10);

-- La sonda anónima solo tiene acceso a una función que devuelve una constante.
select ok(
  has_schema_privilege('anon', 'public', 'USAGE'),
  'anon can resolve the health probe in schema public'
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
      and p.oid <> 'public.database_healthcheck()'::regprocedure
      and has_function_privilege('anon', p.oid, 'EXECUTE')),
  0::bigint,
  'anon cannot execute other functions in public'
);
set local role anon;
select ok(public.database_healthcheck(), 'anon can execute the database health probe');
reset role;

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
