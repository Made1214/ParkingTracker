"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import styles from "./event-screen.module.css";

type Section = { value: string; label: string };

/**
 * Pestañas de la salida. Un indicador se desliza hasta la pestaña elegida
 * en vez de saltar; se mueve al pulsar, sin esperar a que cargue la sección.
 */
export function EventTabs({
  sections,
  active,
  eventUrl,
  pollCount,
}: {
  sections: readonly Section[];
  active: string;
  eventUrl: string;
  pollCount: number;
}) {
  const nav = useRef<HTMLElement>(null);
  const indicator = useRef<HTMLSpanElement>(null);
  const placed = useRef(false);
  const [picked, setPicked] = useState(active);
  const [previous, setPrevious] = useState(active);
  if (previous !== active) {
    setPrevious(active);
    setPicked(active);
  }

  function place(animate: boolean) {
    const link = nav.current?.querySelector<HTMLElement>("[data-active]");
    if (!link || !indicator.current) return;
    const target = {
      x: link.offsetLeft,
      y: link.offsetTop,
      width: link.offsetWidth,
      height: link.offsetHeight,
    };
    if (
      animate &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      gsap.to(indicator.current, {
        ...target,
        duration: 0.4,
        ease: "power3.out",
        overwrite: true,
      });
    else gsap.set(indicator.current, target);
  }

  useLayoutEffect(() => {
    place(placed.current);
    placed.current = true;
    nav.current?.setAttribute("data-ready", "");
    nav.current
      ?.querySelector("[data-active]")
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [picked]);

  // El ancho de las pestañas cambia con la fuente, el contador o la ventana.
  useEffect(() => {
    const element = nav.current;
    if (!element) return;
    const observer = new ResizeObserver(() => place(false));
    observer.observe(element);
    for (const link of element.querySelectorAll("a")) observer.observe(link);
    return () => observer.disconnect();
  }, []);

  return (
    <nav ref={nav} className={styles.tabs} aria-label="Secciones de la salida">
      <span
        ref={indicator}
        className={styles.tabIndicator}
        aria-hidden="true"
      />
      {sections.map(({ value, label }) => (
        <Link
          key={value}
          href={value === "plan" ? eventUrl : `${eventUrl}?section=${value}`}
          aria-current={active === value ? "page" : undefined}
          data-active={picked === value || undefined}
          onClick={(event) => {
            if (
              event.button === 0 &&
              !event.metaKey &&
              !event.ctrlKey &&
              !event.shiftKey &&
              !event.altKey
            )
              setPicked(value);
          }}
        >
          {label}
          {value === "votaciones" && pollCount > 0 && (
            <span className={styles.tabCount}>{pollCount}</span>
          )}
        </Link>
      ))}
    </nav>
  );
}
