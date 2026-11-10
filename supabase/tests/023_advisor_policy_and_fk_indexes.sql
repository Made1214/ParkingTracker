begin;
select plan(2);

-- Toda clave foránea compuesta debe tener un índice no parcial que empiece por
-- sus columnas; si no, borrar la fila padre recorre la tabla hija entera. Falla
-- también cuando una tabla nueva añade una FK de tenant sin su índice.
select is(
  (
    select coalesce(string_agg(c.conrelid::regclass::text || '.' || c.conname, ', '), '')
    from pg_constraint c
    where c.contype = 'f'
      and c.connamespace = 'public'::regnamespace
      and array_length(c.conkey, 1) > 1
      and not exists (
        select 1 from pg_index i
        where i.indrelid = c.conrelid
          and i.indpred is null
          and (i.indkey::int2[])[0:array_length(c.conkey, 1) - 1] @> c.conkey
      )
  ),
  '',
  'every composite foreign key has a covering index'
);

select matches(
  (
    select pg_get_expr(polwithcheck, polrelid) from pg_policy
    where polrelid = 'public.activity_proposals'::regclass and polname = 'activity_proposals_insert'
  ),
  'created_by = \( ?SELECT auth\.uid\(\)',
  'activity_proposals_insert evaluates auth.uid() once per statement'
);

select * from finish();
rollback;
