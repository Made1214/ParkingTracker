"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { browserClient } from "@/shared/supabase/client";

/**
 * Saca de /login y /register a quien ya tiene sesión cuando la pantalla llega
 * sin pasar por el servidor: la flecha "atrás" la restaura desde la caché del
 * router de Next o desde la bfcache del navegador, y el proxy no se entera.
 * Usa getUser (no getSession) para no rebotar con una sesión revocada.
 */
export function SignedInRedirect({ next }: { next: string }) {
  const router = useRouter();
  useEffect(() => {
    let active = true;
    const target = next === "/" ? "/groups" : next;
    const check = async () => {
      const { data } = await browserClient().auth.getUser();
      if (active && data.user) router.replace(target);
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) void check();
    };
    void check();
    window.addEventListener("pageshow", onPageShow);
    return () => {
      active = false;
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [next, router]);
  return null;
}
