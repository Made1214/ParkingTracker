"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useEventChannel } from "@/shared/supabase/use-event-channel";

/**
 * Mantiene al día los contadores de asistencia: cuando otra persona responde,
 * la pantalla se vuelve a pedir al servidor, que es quien aplica RLS y arma los
 * nombres. Un sondeo lento cubre los avisos que se pierdan por el camino.
 */
export function AttendanceRealtime({ eventId }: { eventId: string }) {
  const router = useRouter();
  const timer = useRef<number | undefined>(undefined);
  const refresh = useCallback(() => {
    if (document.visibilityState === "hidden") return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => router.refresh(), 250);
  }, [router]);

  useEventChannel({
    channel: `attendance:${eventId}`,
    table: "event_attendance",
    filter: `event_id=eq.${eventId}`,
    onChange: refresh,
    onReconnect: refresh,
  });

  useEffect(() => {
    const poll = window.setInterval(refresh, 30000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("online", refresh);
    return () => {
      window.clearInterval(poll);
      window.clearTimeout(timer.current);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("online", refresh);
    };
  }, [refresh]);

  return null;
}
