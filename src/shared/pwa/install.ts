"use client";
import { useSyncExternalStore } from "react";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * - `installed`: ya se abre como app (pantalla de inicio).
 * - `promptable`: el navegador ofrece instalación programática (Chromium).
 * - `ios`: Safari en iOS, que solo admite el paso manual «Añadir a inicio».
 * - `unavailable`: no hay forma de saberlo ni de ofrecerla desde la página.
 */
export type InstallStatus = "installed" | "promptable" | "ios" | "unavailable";

let deferred: InstallEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

// Chromium dispara `beforeinstallprompt` muy pronto y una sola vez: se captura
// al cargar el módulo, no al montar el componente que lo usa.
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event as InstallEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installed = true;
    notify();
  });
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos() {
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function status(): InstallStatus {
  if (installed || isStandalone()) return "installed";
  if (deferred) return "promptable";
  return isIos() ? "ios" : "unavailable";
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Abre el diálogo nativo de instalación. Devuelve si la persona aceptó. */
export async function promptInstall() {
  const event = deferred;
  if (!event) return false;
  deferred = null;
  notify();
  await event.prompt();
  return (await event.userChoice).outcome === "accepted";
}

export function useInstallStatus() {
  return useSyncExternalStore(subscribe, status, () => "unavailable" as const);
}

const subscribeOnline = (listener: () => void) => {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
};

export function useOnline() {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}
