"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
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
  const frame = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  // Parallax suave: al desplazarse, la portada se mueve más despacio que la página.
  useEffect(() => {
    const element = frame.current;
    const image = element?.querySelector("img");
    if (!element || !image) return;
    gsap.registerPlugin(ScrollTrigger);
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.fromTo(
        image,
        { yPercent: -4, scale: 1.1 },
        {
          yPercent: 4,
          scale: 1.1,
          ease: "none",
          scrollTrigger: {
            trigger: element,
            start: "top bottom",
            end: "bottom top",
            scrub: true,
          },
        },
      );
    });
    return () => media.revert();
  }, [failed]);

  if (failed)
    return <p className="small muted">No se pudo cargar la portada.</p>;
  return (
    <div ref={frame} className={styles.cover}>
      {/* Private assets are served through a membership-checked route, never the shared image optimizer. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/groups/${groupId}/events/${eventId}/cover?v=${encodeURIComponent(revision)}`}
        alt="Portada del evento"
        width={1600}
        height={900}
        decoding="async"
        onError={() => setFailed(true)}
      />
    </div>
  );
}
