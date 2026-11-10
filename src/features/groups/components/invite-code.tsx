"use client";
import { useState, useRef, useEffect } from "react";
import { Copy, Check } from "lucide-react";
import styles from "./group.module.css";

/** Código de invitación compacto para el encabezado del grupo. */
export function InviteCode({
  code,
  appUrl,
  light = false,
}: {
  code: string;
  appUrl: string;
  /** Versión para fondo claro (ajustes). */
  light?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const url = `${appUrl}/join/${code}`;
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);
  async function copy() {
    if (timerRef.current) clearTimeout(timerRef.current);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      timerRef.current = setTimeout(() => setCopied(false), 2400);
    } catch {
      window.prompt("Copia el enlace de invitación", url);
    }
  }
  return (
    <div className={light ? styles.inviteLight : styles.invite}>
      <div>
        <span>CÓDIGO DE INVITACIÓN</span>
        <code>{code}</code>
      </div>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Enlace copiado" : "Copiar enlace de invitación"}
        title={url}
      >
        {copied ? <Check size={18} /> : <Copy size={18} />}
      </button>
      <span className="sr-only" role="status">
        {copied ? "Enlace copiado" : ""}
      </span>
    </div>
  );
}
