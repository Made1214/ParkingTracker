"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/** Agrupa avisos cercanos y vuelve a consultar al recuperar conexión o foco. */
export function useRealtimeRefresh(enabled = true, refreshAt?: number) {
  const router = useRouter();
  const timer = useRef<number | undefined>(undefined);
  const refresh = useCallback(() => {
    if (document.visibilityState === "hidden") return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => router.refresh(), 250);
  }, [router]);

  useEffect(() => {
    if (!enabled) return;
    const poll = window.setInterval(refresh, 30_000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("online", refresh);
    return () => {
      window.clearInterval(poll);
      window.clearTimeout(timer.current);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("online", refresh);
    };
  }, [enabled, refresh]);

  useEffect(() => {
    if (!enabled || !refreshAt) return;
    const timeout = window.setTimeout(
      refresh,
      Math.min(Math.max(refreshAt - Date.now() + 100, 0), 2_147_483_647),
    );
    return () => window.clearTimeout(timeout);
  }, [enabled, refresh, refreshAt]);

  return refresh;
}
