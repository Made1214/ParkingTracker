"use client";
import { catchError, type ErrorInfo } from "next/error";
import { RotateCw, TriangleAlert } from "lucide-react";
import styles from "./event-screen.module.css";

/**
 * Aísla el fallo de un panel de la salida (plan E4.F4.T2): si gastos no
 * carga, el resto de la pantalla sigue en pie. Las redirecciones y los 404
 * de Next no se capturan; los relanza `catchError` hacia sus propios límites.
 */
function PanelError(
  { label, quiet }: { label: string; quiet?: boolean },
  { retry }: ErrorInfo,
) {
  if (quiet) return null;
  return (
    <div className={styles.panelError} role="alert">
      <TriangleAlert size={18} aria-hidden="true" />
      <p>
        <strong>No pudimos cargar {label}.</strong>
        <span className="small muted">
          El resto de la salida sigue disponible.
        </span>
      </p>
      <button type="button" className={styles.panelRetry} onClick={retry}>
        <RotateCw size={15} aria-hidden="true" /> Reintentar
      </button>
    </div>
  );
}

export const PanelBoundary = catchError(PanelError);
