"use client";

import { useState } from "react";

/** Muestra el avatar decorativo y recupera las iniciales si falla la imagen. */
export function AvatarImage({
  src,
  fallback,
}: {
  src?: string | null;
  fallback: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  if (!src || failed === src) return <>{fallback}</>;
  return (
    // El proxy de medios vuelve a comprobar la autorización de la sesión.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      onError={() => setFailed(src)}
      style={{
        width: "100%",
        height: "100%",
        objectFit: "cover",
        borderRadius: "inherit",
      }}
    />
  );
}
