"use client";
import { useState } from "react";
export function GroupImage({
  groupId,
  revision,
}: {
  groupId: string;
  revision: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    // Private media must bypass the shared image optimizer.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/groups/${groupId}/avatar?v=${encodeURIComponent(revision)}`}
      alt="Imagen del grupo"
      width={80}
      height={80}
      style={{ objectFit: "cover", borderRadius: "var(--radius-lg)" }}
      onError={() => setFailed(true)}
    />
  );
}
