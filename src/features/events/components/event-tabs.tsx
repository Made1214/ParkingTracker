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

  function syncScroll() {
    const element = nav.current;
    if (!element) return;
    const left = element.scrollLeft > 2;
    const right =
      element.scrollLeft + element.clientWidth < element.scrollWidth - 2;
    const shell = element.parentElement;
    if (!shell) return;
    if (left) shell.setAttribute("data-scroll-left", "");
    else shell.removeAttribute("data-scroll-left");
    if (right) shell.setAttribute("data-scroll-right", "");
    else shell.removeAttribute("data-scroll-right");
  }

  useLayoutEffect(() => {
    place(placed.current);
    const element = nav.current;
    const activeLink = element?.querySelector<HTMLElement>("[data-active]");
    if (element && activeLink) {
      const targetLeft =
        activeLink.offsetLeft -
        (element.clientWidth - activeLink.offsetWidth) / 2;
      if (typeof element.scrollTo === "function") {
        element.scrollTo({
          left: Math.max(0, targetLeft),
          behavior:
            placed.current &&
            !window.matchMedia("(prefers-reduced-motion: reduce)").matches
              ? "smooth"
              : "auto",
        });
      } else {
        activeLink.scrollIntoView({ block: "nearest", inline: "center" });
      }
    }
    placed.current = true;
    element?.setAttribute("data-ready", "");
    syncScroll();
  }, [picked]);

  // El ancho de las pestañas cambia con la fuente, el contador o la ventana.
  useEffect(() => {
    const element = nav.current;
    if (!element) return;
    const onResize = () => {
      place(false);
      syncScroll();
    };
    const observer = new ResizeObserver(onResize);
    observer.observe(element);
    for (const link of element.querySelectorAll("a")) observer.observe(link);
    element.addEventListener("scroll", syncScroll, { passive: true });
    syncScroll();
    return () => {
      observer.disconnect();
      element.removeEventListener("scroll", syncScroll);
    };
  }, []);

  function onKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (
      event.key !== "ArrowRight" &&
      event.key !== "ArrowLeft" &&
      event.key !== "Home" &&
      event.key !== "End"
    )
      return;
    const links = Array.from(
      nav.current?.querySelectorAll<HTMLElement>("a") ?? [],
    );
    const index = links.indexOf(document.activeElement as HTMLElement);
    if (index === -1 || links.length === 0) return;
    event.preventDefault();
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? links.length - 1
          : event.key === "ArrowRight"
            ? (index + 1) % links.length
            : (index - 1 + links.length) % links.length;
    const target = links[nextIndex];
    target?.focus();
    target?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  return (
    <div className={styles.tabsShell}>
      <nav
        ref={nav}
        className={styles.tabs}
        aria-label="Secciones de la salida"
        onKeyDown={onKeyDown}
      >
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
    </div>
  );
}
