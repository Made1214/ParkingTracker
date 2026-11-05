"use client";
import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/shared/ui/button";
export function InviteCard({ code, appUrl }: { code: string; appUrl: string }) {
  const [status, setStatus] = useState("");
  const url = `${appUrl}/join/${code}`;
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setStatus("Enlace copiado");
    } catch {
      setStatus("Copia el enlace que aparece abajo.");
    }
  }
  return (
    <div className="invite-box">
      <div>
        <span className="eyebrow">LOS BUENOS PLANES SE COMPARTEN</span>
        <h3>Invita a alguien más</h3>
        <p className="small muted">
          Comparte este enlace solo con las personas que quieras en tu grupo.
        </p>
      </div>
      <div>
        <code className="invite-code">{code}</code>
        <Button variant="outline" onClick={copy}>
          {status === "Enlace copiado" ? (
            <Check size={16} />
          ) : (
            <Copy size={16} />
          )}{" "}
          Copiar invitación
        </Button>
        <p className="small wrap">{url}</p>
        <p className="small" role="status">
          {status}
        </p>
      </div>
    </div>
  );
}
