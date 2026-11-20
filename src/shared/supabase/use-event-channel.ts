"use client";

import { useEffect, useRef } from "react";
import type {
  RealtimePostgresChangesPayload,
  RealtimeChannel,
} from "@supabase/supabase-js";
import { reportClientError } from "@/shared/lib/report-error";
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
  enabled = true,
  withDeletes = false,
}: {
  channel: string;
  table: string;
  filter: string;
  onChange: (change: Change) => void;
  onReconnect?: () => void;
  enabled?: boolean;
  withDeletes?: boolean;
}) {
  // En refs para que un callback nuevo no obligue a reabrir el canal.
  const change = useRef(onChange);
  const reconnect = useRef(onReconnect);
  useEffect(() => {
    change.current = onChange;
    reconnect.current = onReconnect;
  });

  useEffect(() => {
    if (!enabled) return;
    const client = browserClient();
    let cancelled = false;
    let channel: RealtimeChannel | undefined;
    let subscribedBefore = false;
    // Intenta autenticar el canal antes de suscribirse; vuelve a probar al reconectar.
    const subscribe = async () => {
      if (cancelled || channel) return;
      try {
        await client.realtime.setAuth();
        if (cancelled || channel) return;
        channel = client.channel(name);
        for (const event of ["INSERT", "UPDATE"] as const)
          channel.on(
            "postgres_changes",
            { event, schema: "public", table, filter },
            (payload) => change.current(payload),
          );
        if (withDeletes)
          channel.on(
            "postgres_changes",
            { event: "DELETE", schema: "public", table },
            (payload) => change.current(payload),
          );
        channel.subscribe((status) => {
          if (status !== "SUBSCRIBED") return;
          if (subscribedBefore) reconnect.current?.();
          subscribedBefore = true;
        });
      } catch (error) {
        if (!cancelled)
          reportClientError(
            error instanceof Error
              ? error
              : new Error("No se pudo autenticar Realtime"),
          );
      }
    };
    void subscribe();
    window.addEventListener("online", subscribe);
    return () => {
      cancelled = true;
      window.removeEventListener("online", subscribe);
      if (channel) void client.removeChannel(channel);
    };
  }, [name, table, filter, enabled, withDeletes]);
}
