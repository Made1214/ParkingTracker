"use client";

import { useState } from "react";
import styles from "./event-screen.module.css";

export function EventCover({
  groupId,
  eventId,
  revision,
}: {
  groupId: string;
  eventId: string;
  revision: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed)
    return <p className="small muted">No se pudo cargar la portada.</p>;
  return (
    // Private assets are served through a membership-checked route, never the shared image optimizer.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={styles.cover}
      src={`/api/groups/${groupId}/events/${eventId}/cover?v=${encodeURIComponent(revision)}`}
      alt="Portada del evento"
      width={1600}
      height={900}
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
