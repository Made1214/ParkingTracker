-- Realtime para la asistencia (plan E4.F3.T3).
--
-- Los cambios de `event_attendance` se publican por Supabase Realtime para que
-- los contadores del detalle de una salida se actualicen sin recargar.
-- Realtime evalúa la política SELECT de la tabla (`is_group_member(group_id)`)
-- con el JWT de cada suscriptor antes de entregar una fila, así que RLS sigue
-- siendo la única frontera: quien no pertenece al grupo no recibe nada.
--
-- La identidad de réplica se queda en DEFAULT a propósito: un DELETE emite solo
-- la clave primaria, nunca quién había respondido.

alter publication supabase_realtime add table public.event_attendance;
