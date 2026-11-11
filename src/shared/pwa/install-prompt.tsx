"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { promptInstall, useInstallStatus } from "./install";
import { IosInstallSteps } from "./install-steps";
import styles from "./pwa.module.css";

const KEY = "pt-install-prompt";
const EVENT_PATH = /^\/groups\/[^/]+\/events\/[^/]+$/;
/** Se ofrece a partir de la segunda salida abierta: la persona ya usa la app. */
const MIN_EVENT_VIEWS = 2;
const MAX_DISMISSALS = 2;
const COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;

type Memory = { views: number; dismissals: number; dismissedAt: number };

function read(): Memory {
  try {
    return {
      views: 0,
      dismissals: 0,
      dismissedAt: 0,
      ...JSON.parse(localStorage.getItem(KEY) ?? "{}"),
    };
  } catch {
    return { views: 0, dismissals: 0, dismissedAt: 0 };
  }
}

function write(memory: Memory) {
  try {
    localStorage.setItem(KEY, JSON.stringify(memory));
  } catch {
    // Almacenamiento bloqueado: el aviso simplemente no recuerda su estado.
  }
}

/**
 * Invitación a instalar la app. Nunca aparece en la primera carga ni en el
 * enlace de invitación: solo dentro de una salida, cuando ya se abrieron dos, y
 * como mucho dos veces (con 14 días de pausa). Desde el perfil siempre se puede
 * volver a instalar.
 */
export function InstallPrompt() {
  const pathname = usePathname();
  const status = useInstallStatus();
  const [eligible, setEligible] = useState(false);

  useEffect(() => {
    if (!EVENT_PATH.test(pathname)) return;
    const memory = read();
    memory.views += 1;
    write(memory);
    const timer = window.setTimeout(
      () =>
        setEligible(
          memory.views >= MIN_EVENT_VIEWS &&
            memory.dismissals < MAX_DISMISSALS &&
            Date.now() - memory.dismissedAt > COOLDOWN_MS,
        ),
      1500,
    );
    return () => window.clearTimeout(timer);
  }, [pathname]);

  const visible =
    eligible &&
    EVENT_PATH.test(pathname) &&
    (status === "promptable" || status === "ios");
  if (!visible) return null;

  const dismiss = () => {
    const memory = read();
    write({
      ...memory,
      dismissals: memory.dismissals + 1,
      dismissedAt: Date.now(),
    });
    setEligible(false);
  };

  return (
    <aside className={styles.prompt} aria-labelledby="install-prompt-title">
      <button
        type="button"
        className={styles.close}
        aria-label="Ahora no"
        onClick={dismiss}
      >
        <X size={18} aria-hidden="true" />
      </button>
      <h2 id="install-prompt-title">Lleva tus planes en el bolsillo</h2>
      <p className="small muted">
        Instala Parking Tracker y abre tus salidas desde la pantalla de inicio.
      </p>
      {status === "ios" ? (
        <IosInstallSteps />
      ) : (
        <div className={styles.promptActions}>
          <Button
            type="button"
            onClick={async () => {
              await promptInstall();
              setEligible(false);
            }}
          >
            Instalar
          </Button>
          <Button type="button" variant="ghost" onClick={dismiss}>
            Ahora no
          </Button>
        </div>
      )}
    </aside>
  );
}
