"use client";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { promptInstall, useInstallStatus } from "./install";
import { IosInstallSteps } from "./install-steps";

/** Instalación a demanda: siempre disponible, aunque se descartara el aviso. */
export function InstallCard() {
  const status = useInstallStatus();
  return (
    <Card className="appearance-card">
      <div>
        <h2>Instalar la app</h2>
        <p className="small muted">
          {status === "installed"
            ? "Ya la tienes instalada en este dispositivo."
            : "Ábrela desde tu pantalla de inicio, como cualquier otra app."}
        </p>
        {status === "ios" && <IosInstallSteps />}
        {status === "unavailable" && (
          <p className="small muted">
            Busca «Instalar app» o «Añadir a pantalla de inicio» en el menú de
            tu navegador.
          </p>
        )}
      </div>
      {status === "promptable" && (
        <Button type="button" variant="outline" onClick={() => promptInstall()}>
          Instalar
        </Button>
      )}
    </Card>
  );
}
