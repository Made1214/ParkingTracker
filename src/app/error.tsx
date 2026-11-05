"use client";
import { Button } from "@/shared/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="app-main">
      <h1>No pudimos cargar tus planes.</h1>
      <p>Comprueba tu conexión y vuelve a intentarlo.</p>
      <Button onClick={reset}>Volver a intentar</Button>
    </main>
  );
}
