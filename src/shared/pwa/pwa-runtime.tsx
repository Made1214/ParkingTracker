"use client";
import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { useOnline } from "./install";
import styles from "./pwa.module.css";

/**
 * Registra el service worker y avisa cuando no hay conexión. Sin red, detiene
 * cualquier envío de formulario antes de que llegue a React: la acción fallaría
 * y se perdería lo escrito; así el formulario conserva sus valores.
 */
export function PwaRuntime() {
  const online = useOnline();
  const [blockedWhileOffline, setBlockedWhileOffline] = useState(false);

  useEffect(() => {
    // En desarrollo los recursos no llevan hash: cachearlos serviría código viejo.
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Sin service worker la app funciona igual; solo pierde la pantalla offline.
    });
  }, []);

  useEffect(() => {
    const guard = (event: SubmitEvent) => {
      if (navigator.onLine) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setBlockedWhileOffline(true);
    };
    const clear = () => setBlockedWhileOffline(false);
    window.addEventListener("submit", guard, true);
    window.addEventListener("online", clear);
    return () => {
      window.removeEventListener("submit", guard, true);
      window.removeEventListener("online", clear);
    };
  }, []);

  if (online) return null;
  return (
    <p
      className={styles.offline}
      role={blockedWhileOffline ? "alert" : "status"}
      data-blocked={blockedWhileOffline || undefined}
    >
      <WifiOff size={16} aria-hidden="true" />
      {blockedWhileOffline
        ? "Sin conexión: no se envió nada. Lo que escribiste sigue aquí; inténtalo cuando vuelva internet."
        : "Sin conexión. Lo que ves puede estar desactualizado."}
    </p>
  );
}
