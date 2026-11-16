"use client";

import { useEffect, useRef } from "react";
import type {
  RealtimePostgresChangesPayload,
  RealtimeChannel,
} from "@supabase/supabase-js";
import { browserClient } from "./client";

type Change = RealtimePostgresChangesPayload<Record<string, unknown>>;

/**
 * Un canal de Realtime por salida: se abre al montar el componente y se cierra
 * al desmontarlo. Realtime solo avisa; quien lo usa decide qué hacer (casi
 * siempre, volver a pedir la pantalla al servidor).
 *
 * - Escucha `table` filtrada por `filter` (p. ej. `event_id=eq.…`) y además
 *   los DELETE sin filtro: un DELETE viaja solo con la clave primaria, así que
 *   no se puede filtrar por salida y `onChange` debe decidir si le importa.
 * - El canal se une ya con el JWT de la sesión. Si se uniera antes de que el
 *   cliente la lea, entraría como anónimo y RLS descartaría los avisos en
 *   silencio.
 * - `onReconnect` se llama cuando el canal vuelve a estar suscrito tras haberlo
 *   estado antes: pudieron perderse avisos mientras estuvo caído.
 */
export function useEventChannel({
  channel: name,
  table,
  filter,
  onChange,
  onReconnect,
}: {
  channel: string;
  table: string;
  filter: string;
  onChange: (change: Change) => void;
  onReconnect?: () => void;
}) {
  // En refs para que un callback nuevo no obligue a reabrir el canal.
  const change = useRef(onChange);
  const reconnect = useRef(onReconnect);
  useEffect(() => {
    change.current = onChange;
    reconnect.current = onReconnect;
  });

  useEffect(() => {
    const client = browserClient();
    let cancelled = false;
    let channel: RealtimeChannel | undefined;
    let subscribedBefore = false;
    void client.realtime
      .setAuth()
      .catch(() => undefined)
      .then(() => {
        if (cancelled) return;
        channel = client
          .channel(name)
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table, filter },
            (payload) => change.current(payload),
          )
          .on(
            "postgres_changes",
            { event: "DELETE", schema: "public", table },
            (payload) => change.current(payload),
          )
          .subscribe((status) => {
            if (status !== "SUBSCRIBED") return;
            if (subscribedBefore) reconnect.current?.();
            subscribedBefore = true;
          });
      });
    return () => {
      cancelled = true;
      if (channel) void client.removeChannel(channel);
    };
  }, [name, table, filter]);
}
