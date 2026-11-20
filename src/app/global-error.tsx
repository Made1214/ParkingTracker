"use client";

import { useEffect } from "react";
import { reportClientError } from "@/shared/lib/report-error";
import { Button } from "@/shared/ui/button";
import "./globals.css";

/** Recupera la navegación si falla el layout raíz y registra el error. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => reportClientError(error), [error]);
  return (
    <html lang="es">
      <body>
        <main className="app-main">
          <h1>No pudimos abrir Parking Tracker.</h1>
          <Button onClick={reset}>Volver a intentar</Button>
        </main>
      </body>
    </html>
  );
}
