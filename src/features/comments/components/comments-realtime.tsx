"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { browserClient } from "@/shared/supabase/client";

/**
 * Mantiene el hilo de comentarios al día. Realtime solo avisa: la lista se
 * vuelve a pedir al servidor, que es quien aplica RLS y arma autores y permisos.
 */
export function CommentsRealtime({
  eventId,
  commentIds,
}: {
  eventId: string;
  /** Ids visibles, separados por comas (cadena estable entre renders). */
  commentIds: string;
}) {
  const router = useRouter();
  // En una ref para que un comentario nuevo no obligue a reabrir el canal.
  const visibleIds = useRef(commentIds);
  useEffect(() => {
    visibleIds.current = commentIds;
  }, [commentIds]);
  useEffect(() => {
    const client = browserClient();
    let refreshTimer: number | undefined;
    const scheduleRefresh = () => {
      if (document.visibilityState === "hidden") return;
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => router.refresh(), 250);
    };
    let cancelled = false;
    let channel: RealtimeChannel | undefined;
    let subscribedBefore = false;
    // El canal debe unirse ya con el JWT de la sesión. Si se une antes de que
    // el cliente termine de leerla, entra como anónimo y RLS descarta todos
    // los avisos sin dar error.
    void client.realtime
      .setAuth()
      .catch(() => undefined)
      .then(() => {
        if (cancelled) return;
        channel = client
          .channel(`comments:${eventId}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "comments",
              filter: `event_id=eq.${eventId}`,
            },
            scheduleRefresh,
          )
          // Un DELETE viaja solo con la clave primaria, así que no se puede
          // filtrar por salida: se compara con los comentarios en pantalla.
          .on(
            "postgres_changes",
            { event: "DELETE", schema: "public", table: "comments" },
            (payload) => {
              if (
                visibleIds.current.split(",").includes(String(payload.old.id))
              )
                scheduleRefresh();
            },
          )
          .subscribe((status) => {
            if (status !== "SUBSCRIBED") return;
            // Tras una reconexión pudieron perderse avisos; la primera vez los
            // datos del servidor ya están frescos.
            if (subscribedBefore) scheduleRefresh();
            subscribedBefore = true;
          });
      });
    // Un sondeo lento cubre los avisos que se pierdan por el camino.
    const timer = window.setInterval(scheduleRefresh, 30000);
    document.addEventListener("visibilitychange", scheduleRefresh);
    window.addEventListener("online", scheduleRefresh);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.clearTimeout(refreshTimer);
      document.removeEventListener("visibilitychange", scheduleRefresh);
      window.removeEventListener("online", scheduleRefresh);
      if (channel) void client.removeChannel(channel);
    };
  }, [eventId, router]);
  return null;
}
