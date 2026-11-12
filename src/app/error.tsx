"use client";
import { useEffect } from "react";
import { Button } from "@/shared/ui/button";
import { reportClientError } from "@/shared/lib/report-error";
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => reportClientError(error), [error]);
  return (
    <main className="app-main">
      <h1>No pudimos cargar tus planes.</h1>
      <p>Comprueba tu conexión y vuelve a intentarlo.</p>
      <Button onClick={reset}>Volver a intentar</Button>
    </main>
  );
}
