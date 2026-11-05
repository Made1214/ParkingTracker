"use client";
import { useState, useRef, useEffect } from "react";
import { Copy, Check, Share2 } from "lucide-react";
import { Button } from "@/shared/ui/button";
export function InviteCard({ code, appUrl }: { code: string; appUrl: string }) {
  const [status, setStatus] = useState("");
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
      setStatus("Enlace copiado");
      timerRef.current = setTimeout(() => setStatus(""), 2400);
    } catch {
      setStatus("Copia el enlace que aparece abajo.");
    }
  }
  const copied = status === "Enlace copiado";
  return (
    <div className="invite-box">
      <div className="invite-copy">
        <div className="invite-title-row">
          <span className="invite-icon" aria-hidden="true">
            <Share2 size={17} />
          </span>
          <div>
            <h3>Invita a alguien más</h3>
            <p className="small muted">
              Comparte este código o enlace con las personas que quieras sumar
              al grupo.
            </p>
          </div>
        </div>
      </div>
      <div className="invite-actions">
        <div className="invite-controls">
          <div className={`invite-code-pill ${copied ? "copied" : ""}`}>
            <span className="invite-code-label">Código</span>
            <code className="invite-code">{code}</code>
          </div>
          <Button
            variant="outline"
            onClick={copy}
            className={`copy-invite-btn ${copied ? "is-copied" : ""}`}
          >
            <span
              key={copied ? "copied" : "idle"}
              className="btn-morph-content"
            >
              {copied ? <Check size={15} /> : <Copy size={15} />}
              <span>{copied ? "Enlace copiado" : "Copiar invitación"}</span>
            </span>
          </Button>
        </div>
        <p className="small muted wrap invite-url">{url}</p>
        <p className="sr-only" role="status">
          {status}
        </p>
      </div>
    </div>
  );
}
