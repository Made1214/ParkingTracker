"use client";
import { Share, SquarePlus } from "lucide-react";
import styles from "./pwa.module.css";

/** iOS no permite instalar desde la página: se explica el paso manual. */
export function IosInstallSteps() {
  return (
    <ol className={styles.steps}>
      <li>
        <Share size={16} aria-hidden="true" /> En Safari, toca{" "}
        <strong>Compartir</strong>.
      </li>
      <li>
        <SquarePlus size={16} aria-hidden="true" /> Elige{" "}
        <strong>Añadir a pantalla de inicio</strong>.
      </li>
    </ol>
  );
}
