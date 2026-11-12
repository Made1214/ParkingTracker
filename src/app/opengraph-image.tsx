import { ImageResponse } from "next/og";
import { site } from "@/shared/lib/site";

export const alt = site.title;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Imagen al compartir un enlace (Open Graph y Twitter), con la paleta Noche serena. */
export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 80,
        background: "#121120",
        color: "#f4f2ff",
        fontFamily: "Georgia, serif",
      }}
    >
      <div style={{ fontSize: 34, letterSpacing: 2, color: "#b8b2f0" }}>
        PARKING TRACKER
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ fontSize: 92, lineHeight: 1.05 }}>Planes claros.</div>
        <div style={{ fontSize: 92, lineHeight: 1.05, color: "#7fd1b9" }}>
          Cero caos de chat.
        </div>
      </div>
      <div style={{ fontSize: 30, color: "#b8b2f0" }}>
        Quién va, qué se hace y quién lleva qué, solo para tu grupo.
      </div>
    </div>,
    size,
  );
}
