begin;
select plan(3);

select ok(
  exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'event_attendance'
  ),
  'event_attendance is published to Realtime'
);

-- Realtime entrega cada fila según la política SELECT del suscriptor, así que
-- publicar la tabla solo es seguro mientras RLS siga activo y forzado.
select ok(
  (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.event_attendance'::regclass),
  'event_attendance keeps RLS enabled and forced'
);

-- Con identidad DEFAULT, un DELETE emite solo la clave primaria.
select is(
  (select relreplident::text from pg_class where oid = 'public.event_attendance'::regclass),
  'd',
  'event_attendance keeps the default replica identity'
);

select * from finish();
rollback;
