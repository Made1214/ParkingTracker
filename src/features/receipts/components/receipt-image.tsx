"use client";

import { useState } from "react";
import type { Bbox } from "../lib/document";
import styles from "./receipts.module.css";

export type Highlight = {
  key: string;
  bbox: Bbox;
  tone: string;
  label?: string;
  /** 0..1: opacidad según la parte que corresponde. */
  strength?: number;
};

/**
 * Factura original con regiones resaltadas. La imagen nunca se modifica: los
 * resaltados son capas encima, posicionadas en porcentajes.
 */
export function ReceiptImage({
  src,
  highlights = [],
  alt = "Factura original",
}: {
  src: string | null;
  highlights?: Highlight[];
  alt?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed)
    return (
      <div className={styles.imageEmpty}>
        {failed
          ? "No se pudo cargar la foto de la factura."
          : "Sin foto de la factura."}
      </div>
    );
  return (
    <figure className={styles.imageFrame}>
      {/* next/image no: la imagen es privada y ya viene firmada/procesada. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} onError={() => setFailed(true)} />
      {highlights.map((h) => (
        <span
          key={h.key}
          className={`${styles.highlight} ${styles[h.tone] ?? ""}`}
          style={{
            left: `${h.bbox.x * 100}%`,
            top: `${h.bbox.y * 100}%`,
            width: `${h.bbox.w * 100}%`,
            height: `${h.bbox.h * 100}%`,
            opacity: 0.35 + 0.65 * (h.strength ?? 1),
          }}
          aria-hidden="true"
        >
          {h.label && <span className={styles.highlightLabel}>{h.label}</span>}
        </span>
      ))}
    </figure>
  );
}
